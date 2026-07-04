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
  // userId -> ConnectedClient
  private clients = new Map<string, ConnectedClient>();
  // To prevent race conditions on room creation DB fetch
  private roomCreationLocks = new Map<string, Promise<void>>();
  // Track rooms with unsaved CRDT changes
  private dirtyRooms = new Set<string>();
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
    const roomsToSave = Array.from(this.dirtyRooms);
    this.dirtyRooms.clear();

    for (const roomId of roomsToSave) {
      const ydoc = this.ydocs.get(roomId);
      if (!ydoc) continue;

      try {
        const content = ydoc.getText('monaco').toString();
        const crdtState = Buffer.from(Y.encodeStateAsUpdate(ydoc));
        
        const exists = await prisma.file.findUnique({ where: { id: roomId } });
        if (exists) {
          await prisma.file.update({
            where: { id: roomId },
            data: { content, crdtState },
          });
        }
      } catch (err) {
        console.error(`[WS] Failed to auto-save room snapshot ${roomId}:`, err);
      }
    }
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

    // Wait for room initialization if it's currently being created
    if (this.roomCreationLocks.has(roomId)) {
      await this.roomCreationLocks.get(roomId);
    }

    // Permission check
    let permission: 'VIEW' | 'EDIT' = 'VIEW';
    try {
      const file = await prisma.file.findUnique({
        where: { id: roomId },
        include: { room: { include: { collaborators: true } } },
      });

      if (!file || !file.room) {
        this.sendToClient(userId, {
          type: 'error',
          payload: { message: 'File or room not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const isCollaborator = file.room.collaborators.find(c => c.userId === userId);

      if (file.room.ownerId === userId) {
        permission = 'EDIT';
      } else if (isCollaborator) {
        permission = isCollaborator.role as 'VIEW' | 'EDIT';
      } else if (file.room.isPublic) {
        permission = file.room.publicAccess as 'VIEW' | 'EDIT';
      } else {
        this.sendToClient(userId, {
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
      
      const ydoc = new Y.Doc();
      this.ydocs.set(roomId, ydoc);
      
      // Lock room creation until DB fetch completes
      const initPromise = (async () => {
        try {
          const file = await prisma.file.findUnique({ where: { id: roomId } });
          if (file) {
            if (file.crdtState) {
              // Restore full CRDT history
              Y.applyUpdate(ydoc, new Uint8Array(file.crdtState));
            } else if (file.content) {
              // Fallback for older files
              const ytext = ydoc.getText('monaco');
              ytext.insert(0, file.content);
            }
          }
        } catch (err) {
          console.error(`[WS] Failed to load file ${roomId} for Y.Doc:`, err);
        }
      })();
      
      this.roomCreationLocks.set(roomId, initPromise);
      await initPromise;
      this.roomCreationLocks.delete(roomId);
    }

    const room = this.rooms.get(roomId)!;
    if (room.has(connectionId)) return; // Already in room

    room.add(connectionId);
    client.rooms.add(roomId);

    console.log(`[WS] ${client.username} joined room ${roomId} | Room size: ${room.size}`);

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

    // Send initial Yjs state
    const ydoc = this.ydocs.get(roomId);
    if (ydoc) {
      const state = Y.encodeStateAsUpdate(ydoc);
      this.sendToClient(connectionId, {
        type: 'yjs-sync',
        roomId,
        payload: { update: fromByteArray(state) },
        timestamp: new Date().toISOString(),
      });
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
      this.rooms.delete(roomId);
      this.dirtyRooms.delete(roomId);
      
      const ydoc = this.ydocs.get(roomId);
      if (ydoc) {
        try {
          const content = ydoc.getText('monaco').toString();
          const crdtState = Buffer.from(Y.encodeStateAsUpdate(ydoc));
          // Update only if file still exists in DB
          const exists = await prisma.file.findUnique({ where: { id: roomId } });
          if (exists) {
            await prisma.file.update({
              where: { id: roomId },
              data: { content, crdtState },
            });
          }
        } catch (err) {
          console.error(`[WS] Failed to save file ${roomId} on room destroy:`, err);
        }
        this.ydocs.delete(roomId);
      }
      
      console.log(`[WS] Room destroyed: ${roomId}`);
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
  applyYjsUpdate(roomId: string, updateBase64: string): boolean {
    const ydoc = this.ydocs.get(roomId);
    if (ydoc) {
      try {
        Y.applyUpdate(ydoc, toByteArray(updateBase64));
        this.dirtyRooms.add(roomId);
        return true;
      } catch (err) {
        console.error(`[WS] Failed to apply Yjs update for room ${roomId}:`, err);
        return false;
      }
    }
    return false;
  }

  /**
   * Get the cached permission for a user in a room.
   */
  getPermission(roomId: string, userId: string): 'VIEW' | 'EDIT' {
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
