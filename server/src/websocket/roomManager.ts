import { WebSocket } from 'ws';
import * as Y from 'yjs';
import { fromByteArray, toByteArray } from 'base64-js';
import { ConnectedClient, WSMessage } from '../types';
import { prisma } from '../db';

/**
 * RoomManager — Manages WebSocket rooms and client connections.
 * Each document ID maps to one room. Clients can join multiple rooms.
 */
export class RoomManager {
  // roomId -> Set of client userIds
  private rooms = new Map<string, Set<string>>();
  // roomId -> Y.Doc
  private ydocs = new Map<string, Y.Doc>();
  private pendingDocs = new Map<string, Promise<Y.Doc>>();
  // userId -> ConnectedClient
  public clients = new Map<string, ConnectedClient>();
  // To prevent race conditions on room creation DB fetch
  private roomCreationLocks = new Map<string, Promise<void>>();
  // To prevent race conditions on client join (permission fetch)
  private joinLocks = new Map<string, Promise<void>>();
  // Track rooms with unsaved CRDT changes
  private dirtyDocs = new Set<string>();
  // Track permissions: `${fileId}:${userId}` -> 'VIEW' | 'EDIT'
  private permissions = new Map<string, 'VIEW' | 'EDIT'>();
  private saveInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Snapshot dirty rooms every 30 seconds
    this.saveInterval = setInterval(() => this.saveDirtyRooms(), 30000);
  }

  /**
   * Periodically save all dirty Yjs documents to PostgreSQL
   */
  private async saveDirtyRooms(): Promise<void> {
    const docsToSave = Array.from(this.dirtyDocs);
    this.dirtyDocs.clear();

    for (const docId of docsToSave) {
      const ydoc = this.ydocs.get(docId);
      if (!ydoc) continue;
      
      // If docId starts with canvas-, it's canvas data (not saved in File DB currently)
      if (docId.startsWith('canvas-')) continue;

      try {
        const content = ydoc.getText('monaco').toString();
        const crdtState = Buffer.from(Y.encodeStateAsUpdate(ydoc));
        
        const exists = await prisma.file.findUnique({ where: { id: docId } });
        if (exists) {
          await prisma.file.update({
            where: { id: docId },
            data: { content, crdtState },
          });
        }
      } catch (err) {
        console.error(`[WS] Failed to auto-save doc snapshot ${docId}:`, err);
      }
    }
  }

  /**
   * Get a Y.Doc if it exists in memory without hitting the DB.
   */
  getDocIfExists(fileId: string): Y.Doc | null {
    return this.ydocs.get(fileId) ?? null;
  }

  /**
   * Force save all active Y.Docs for a given room (workspace).
   */
  async saveRoomNow(roomId: string): Promise<void> {
    for (const [fileId, ydoc] of this.ydocs.entries()) {
      const file = await prisma.file.findUnique({
        where: { id: fileId },
        select: { roomId: true },
      });
      if (file?.roomId !== roomId) continue;

      const content = ydoc.getText('monaco').toString();
      const crdtState = Buffer.from(Y.encodeStateAsUpdate(ydoc));
      await prisma.file.update({
        where: { id: fileId },
        data: { content, crdtState },
      });
    }
  }

  /**
   * Safely get or create a Y.Doc preventing race conditions.
   * `docId` can be a file ID or `canvas-${roomId}`
   */
  async getOrCreateDoc(docId: string): Promise<Y.Doc> {
    if (this.ydocs.has(docId)) return this.ydocs.get(docId)!;
    if (this.pendingDocs.has(docId)) return this.pendingDocs.get(docId)!;

    const promise = (async () => {
      const ydoc = new Y.Doc();
      try {
        // If it's a file, try to seed it from DB
        if (!docId.startsWith('canvas-')) {
          const file = await prisma.file.findUnique({
            where: { id: docId },
            select: { content: true, crdtState: true },
          });

          if (file) {
            if (file.crdtState) {
              Y.applyUpdate(ydoc, new Uint8Array(file.crdtState));
            } else if (file.content) {
              ydoc.getText('monaco').insert(0, file.content);
            }
          }
        }
      } catch (err) {
        console.error(`[WS] Failed to seed Y.Doc for ${docId}:`, err);
      }
      this.ydocs.set(docId, ydoc);
      this.pendingDocs.delete(docId);
      return ydoc;
    })();

    this.pendingDocs.set(docId, promise);
    return promise;
  }

  /**
   * Register a new client connection.
   */
  addClient(connectionId: string, userId: string, username: string, socket: WebSocket): ConnectedClient {
    // We no longer close stale connections because users might be testing with multiple tabs!
    // They will just get a new connectionId and BOTH tabs will work.

    const client: ConnectedClient = {
      connectionId,
      userId,
      username,
      socket,
      rooms: new Set(),
      isAlive: true,
      connectedAt: new Date().toISOString(),
    };

    this.clients.set(connectionId, client);
    console.log(`[WS] Client connected: ${username} (${connectionId}) | Total: ${this.clients.size}`);
    return client;
  }

  /**
   * Remove a client connection and clean up all room memberships.
   */
  async removeClient(connectionId: string): Promise<void> {
    const client = this.clients.get(connectionId);
    if (!client) return;

    // Leave all rooms
    const roomsToLeave = Array.from(client.rooms);
    for (const roomId of roomsToLeave) {
      await this.leaveRoom(roomId, connectionId);
    }

    this.clients.delete(connectionId);
    console.log(`[WS] Client disconnected: ${client.username} | Total: ${this.clients.size}`);
  }

  /**
   * Add a client to a room.
   */
  async joinRoom(roomId: string, connectionId: string, userId: string): Promise<void> {
    const client = this.clients.get(connectionId);
    if (!client) return;

    // Create a lock for this connection joining this room
    const lockKey = `${roomId}:${connectionId}`;
    let resolveJoinLock!: () => void;
    const joinPromise = new Promise<void>(resolve => { resolveJoinLock = resolve; });
    this.joinLocks.set(lockKey, joinPromise);

    try {
      // Wait for room initialization if it's currently being created
      if (this.roomCreationLocks.has(roomId)) {
        await this.roomCreationLocks.get(roomId);
      }

      // Single DB query for both permission check AND file content
      let permission: 'VIEW' | 'EDIT' = 'VIEW';
      let roomRecord: any = null;
      try {
        roomRecord = await prisma.room.findUnique({
          where: { id: roomId },
          include: { collaborators: true },
        });

        if (!roomRecord) {
          console.log(`[WS] joinRoom failed: room not found for ${roomId}`);
          this.sendToClient(connectionId, {
            type: 'error',
            payload: { message: 'Room not found' },
            timestamp: new Date().toISOString(),
          });
          return;
        }

        const isCollaborator = roomRecord.collaborators.find((c: any) => c.userId === userId);

        if (roomRecord.ownerId === userId) {
          permission = 'EDIT';
        } else if (isCollaborator) {
          permission = isCollaborator.role as 'VIEW' | 'EDIT';
        } else if (roomRecord.isPublic) {
          permission = roomRecord.publicAccess as 'VIEW' | 'EDIT';
        } else {
          console.log(`[WS] joinRoom denied: ${client.username} has no access to ${roomId}`);
          this.sendToClient(connectionId, {
            type: 'error',
            payload: { message: 'Access denied' },
            timestamp: new Date().toISOString(),
          });
          return;
        }
      } catch (err) {
        console.error(`[WS] Permission check failed for ${roomId}:`, err);
        return;
      }

      // Store permission
      this.permissions.set(`${roomId}:${userId}`, permission);

      // Create room if it doesn't exist
      if (!this.rooms.has(roomId)) {
        this.rooms.set(roomId, new Set());
        console.log(`[WS] Room created: ${roomId}`);
      }

      const room = this.rooms.get(roomId)!;
      if (room.has(connectionId)) return; // Already in room

      room.add(connectionId);
      client.rooms.add(roomId);

      console.log(`[WS] ${client.username} joined room ${roomId} (${permission}) | Room size: ${room.size}`);

      // Notify other room members
      this.broadcast(roomId, {
        type: 'user-joined',
        roomId,
        payload: {
          userId: client.userId,
          username: client.username,
        },
        timestamp: new Date().toISOString(),
      }, connectionId);

      // Send current room users to the joining client
      this.sendToClient(connectionId, {
        type: 'room-users',
        roomId,
        payload: this.getRoomUsers(roomId),
        timestamp: new Date().toISOString(),
      });
    } finally {
      resolveJoinLock();
      this.joinLocks.delete(lockKey);
    }
  }

  /**
   * Remove a client from a room.
   */
  async leaveRoom(roomId: string, connectionId: string): Promise<void> {
    const client = this.clients.get(connectionId);
    const room = this.rooms.get(roomId);
    if (!room || !client) return;

    room.delete(connectionId);
    client.rooms.delete(roomId);

    console.log(`[WS] ${client.username} left room ${roomId} | Room size: ${room.size}`);

    // Notify remaining members
    this.broadcast(roomId, {
      type: 'user-left',
      roomId,
      payload: {
        userId: client.userId,
        username: client.username,
      },
      timestamp: new Date().toISOString(),
    });

    // Clean up empty rooms
    if (room.size === 0) {
      // Save all active Y.Docs for this room
      try {
        const files = await prisma.file.findMany({ where: { roomId }, select: { id: true } });
        for (const file of files) {
          const docId = file.id;
          const ydoc = this.ydocs.get(docId);
          if (ydoc) {
            const content = ydoc.getText('monaco').toString();
            const crdtState = Buffer.from(Y.encodeStateAsUpdate(ydoc));
            await prisma.file.update({
              where: { id: docId },
              data: { content, crdtState },
            });
          }
        }
      } catch (err) {
        console.error(`[WS] Failed to save files on room destroy:`, err);
      }
      
      // Check room size AGAIN because a user might have reconnected (e.g. refreshed) 
      // while we were waiting for the database!
      if (room.size === 0) {
        this.rooms.delete(roomId);
        try {
          const files = await prisma.file.findMany({ where: { roomId }, select: { id: true } });
          for (const file of files) {
            this.dirtyDocs.delete(file.id);
            this.ydocs.delete(file.id);
          }
          this.dirtyDocs.delete(`canvas-${roomId}`);
          this.ydocs.delete(`canvas-${roomId}`);
        } catch (err) {}
        console.log(`[WS] Room destroyed: ${roomId}`);
      } else {
        console.log(`[WS] Room ${roomId} was saved but not destroyed because a user joined during save`);
      }
    }
  }

  /**
   * Broadcast a message to all clients in a room.
   */
  broadcast(roomId: string, message: WSMessage, excludeConnectionId?: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const data = JSON.stringify(message);

    for (const connectionId of room) {
      if (connectionId === excludeConnectionId) continue;
      const client = this.clients.get(connectionId);
      if (client && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(data);
      }
    }
  }

  /**
   * Send a message to a specific client.
   */
  sendToClient(connectionId: string, message: WSMessage): void {
    const client = this.clients.get(connectionId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(message));
    }
  }

  /**
   * Get public user info for all clients in a room.
   */
  getRoomUsers(roomId: string): Array<{ userId: string; username: string }> {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    return Array.from(room)
      .map((connectionId) => {
        const client = this.clients.get(connectionId);
        return client
          ? { userId: client.userId, username: client.username }
          : null;
      })
      .filter((u): u is { userId: string; username: string } => u !== null);
  }

  /**
   * Get a client by connectionId.
   */
  getClient(connectionId: string): ConnectedClient | undefined {
    return this.clients.get(connectionId);
  }

  /**
   * Get total connected clients.
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get total active rooms.
   */
  getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * Get stats for health check.
   */
  getStats(): { clients: number; rooms: number; roomDetails: Record<string, number> } {
    const roomDetails: Record<string, number> = {};
    for (const [roomId, members] of this.rooms) {
      roomDetails[roomId] = members.size;
    }
    return {
      clients: this.clients.size,
      rooms: this.rooms.size,
      roomDetails,
    };
  }

  /**
   * Apply a Yjs update to the server's in-memory document.
   * Returns true if successful, false otherwise.
   */
  applyYjsUpdate(docId: string, updateBase64: string): boolean {
    const ydoc = this.ydocs.get(docId);
    if (ydoc) {
      try {
        Y.applyUpdate(ydoc, toByteArray(updateBase64));
        this.dirtyDocs.add(docId);
        return true;
      } catch (err) {
        console.error(`[WS] Failed to apply Yjs update for doc ${docId}:`, err);
        return false;
      }
    }
    return false;
  }

  /**
   * Wait for a pending join operation for this connection to prevent race conditions.
   */
  async waitForJoinLock(roomId: string, connectionId: string): Promise<void> {
    const lockKey = `${roomId}:${connectionId}`;
    if (this.joinLocks.has(lockKey)) {
      await this.joinLocks.get(lockKey);
    }
  }

  /**
   * Get the cached permission for a user in a room.
   * Awaits any pending join operation for this connection to prevent race conditions.
   */
  async getPermission(roomId: string, connectionId: string, userId: string): Promise<'VIEW' | 'EDIT'> {
    await this.waitForJoinLock(roomId, connectionId);
    return this.permissions.get(`${roomId}:${userId}`) || 'VIEW';
  }

  /**
   * Check heartbeat for all connected clients.
   * Terminates clients that haven't responded to the previous ping.
   */
  checkHeartbeats(): void {
    for (const [connectionId, client] of this.clients.entries()) {
      if (!client.isAlive) {
        console.log(`[WS] Terminating dead connection: ${client.username} (${connectionId})`);
        client.socket.terminate();
        this.removeClient(connectionId).catch(console.error);
        continue;
      }
      
      client.isAlive = false;
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.ping();
      }
    }
  }
}

export const roomManager = new RoomManager();
