import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server as HttpServer } from 'http';
import { URL } from 'url';
import { RoomManager } from './roomManager';
import { verifyToken } from '../middleware/auth';
import { WSMessage } from '../types';

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds

/**
 * Initialize the WebSocket server, attach it to the HTTP server,
 * and handle connection lifecycle + message routing.
 */
export function initWebSocket(httpServer: HttpServer): RoomManager {
  const roomManager = new RoomManager();

  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
  });

  console.log('[WS] WebSocket server initialized on path /ws');

  // ── Connection handler ──
  wss.on('connection', (socket: WebSocket, req: IncomingMessage) => {
    // Extract JWT token from query params
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      socket.close(4001, 'Authentication required');
      return;
    }

    const user = verifyToken(token);
    if (!user) {
      socket.close(4003, 'Invalid or expired token');
      return;
    }

    // Register client
    const client = roomManager.addClient(user.userId, user.username, socket);

    // Send welcome message
    const welcomeMsg: WSMessage = {
      type: 'room-message',
      payload: {
        message: 'Connected to StreamSync',
        userId: user.userId,
        username: user.username,
      },
      timestamp: new Date().toISOString(),
    };
    socket.send(JSON.stringify(welcomeMsg));

    // ── Message handler ──
    socket.on('message', (rawData) => {
      try {
        const message: WSMessage = JSON.parse(rawData.toString());
        handleMessage(roomManager, user.userId, message);
      } catch (err) {
        console.error(`[WS] Invalid message from ${user.username}:`, err);
        socket.send(JSON.stringify({
          type: 'error',
          payload: { message: 'Invalid message format' },
          timestamp: new Date().toISOString(),
        }));
      }
    });

    // ── Pong handler (heartbeat) ──
    socket.on('pong', () => {
      client.isAlive = true;
    });

    // ── Close handler ──
    socket.on('close', (code, reason) => {
      console.log(`[WS] Socket closed: ${user.username} (code: ${code}, reason: ${reason.toString() || 'none'})`);
      roomManager.removeClient(user.userId).catch(console.error);
    });

    // ── Error handler ──
    socket.on('error', (err) => {
      console.error(`[WS] Socket error for ${user.username}:`, err.message);
    });
  });

  // ── Heartbeat interval ──
  const heartbeat = setInterval(() => {
    roomManager.checkHeartbeats();
  }, HEARTBEAT_INTERVAL);

  wss.on('close', () => {
    clearInterval(heartbeat);
    console.log('[WS] WebSocket server closed');
  });

  return roomManager;
}

/**
 * Route incoming WebSocket messages to the appropriate handler.
 */
function handleMessage(roomManager: RoomManager, userId: string, message: WSMessage): void {
  switch (message.type) {
    case 'join-room': {
      if (!message.roomId) {
        roomManager.sendToClient(userId, {
          type: 'error',
          payload: { message: 'roomId is required for join-room' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      roomManager.joinRoom(message.roomId, userId).catch(console.error);
      break;
    }

    case 'leave-room': {
      if (!message.roomId) return;
      roomManager.leaveRoom(message.roomId, userId).catch(console.error);
      break;
    }

    case 'room-message': {
      if (!message.roomId) return;
      const client = roomManager.getClient(userId);
      if (!client) return;

      // Relay message to all room members except sender
      roomManager.broadcast(message.roomId, {
        type: 'room-message',
        roomId: message.roomId,
        payload: {
          ...message.payload as object,
          userId: client.userId,
          username: client.username,
        },
        timestamp: new Date().toISOString(),
      }, userId);
      break;
    }

    case 'ping': {
      roomManager.sendToClient(userId, {
        type: 'pong',
        timestamp: new Date().toISOString(),
      });
      break;
    }

    case 'yjs-update': {
      if (!message.roomId || !message.payload) return;
      const perm = roomManager.getPermission(message.roomId, userId);
      if (perm !== 'EDIT') {
        console.log(`[WS] yjs-update rejected for ${userId} in ${message.roomId} (Permission: ${perm})`);
        return;
      }
      const payload = message.payload as any;
      if (typeof payload.update === 'string') {
        // Validate FIRST, broadcast ONLY if valid
        const applied = roomManager.applyYjsUpdate(message.roomId, payload.update);
        if (applied) {
          roomManager.broadcast(message.roomId, message, userId);
        } else {
          console.log(`[WS] yjs-update failed to apply for ${message.roomId} (ydoc not found or apply failed)`);
        }
      }
      break;
    }

    case 'awareness-update': {
      if (!message.roomId || !message.payload) return;
      roomManager.broadcast(message.roomId, message, userId);
      break;
    }

    default: {
      roomManager.sendToClient(userId, {
        type: 'error',
        payload: { message: `Unknown message type: ${message.type}` },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
