type WSMessageType =
  | 'join-room'
  | 'leave-room'
  | 'room-message'
  | 'room-users'
  | 'user-joined'
  | 'user-left'
  | 'yjs-sync'
  | 'yjs-update'
  | 'awareness-update'
  | 'sync-doc'
  | 'error'
  | 'ping'
  | 'pong';

interface WSMessage {
  type: WSMessageType;
  roomId?: string;
  payload?: unknown;
  timestamp?: string;
}

type MessageHandler = (message: WSMessage) => void;
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
type StatusHandler = (status: ConnectionStatus) => void;

// Derive WebSocket URL: in production, always connect to Render backend
function getWsBase(): string {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'ws://localhost:3001';
  }
  // Production: always use the Render backend
  return 'wss://streamsync-cxox.onrender.com';
}

/**
 * WebSocket client service with auto-reconnect, room management,
 * and event-based message handling.
 */
class WebSocketService {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private statusHandlers: Set<StatusHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private joinedRooms: Set<string> = new Set();

  private _status: ConnectionStatus = 'disconnected';
  private _roomUsers: Map<string, Array<{ userId: string; username: string }>> = new Map();

  get status(): ConnectionStatus {
    return this._status;
  }

  get roomUsers(): Map<string, Array<{ userId: string; username: string }>> {
    return this._roomUsers;
  }

  /**
   * Connect to the WebSocket server with a JWT token.
   */
  connect(token: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    this.token = token;
    this.setStatus('connecting');

    const wsBase = getWsBase();
    const wsUrl = `${wsBase}/ws?token=${encodeURIComponent(token)}`;
    console.log('[WS] Connecting to:', wsUrl);

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('[WS] Connected');
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        this.startPing();

        // Rejoin rooms after reconnect
        for (const roomId of this.joinedRooms) {
          this.send({ type: 'join-room', roomId });
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data as string);
          if (message.type !== 'ping' && message.type !== 'pong') {
            console.log(`[WS] Received ${message.type}:`, message);
          }
          this.handleMessage(message);
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      this.socket.onclose = (event) => {
        console.log(`[WS] Disconnected (code: ${event.code}, reason: ${event.reason})`);
        this.setStatus('disconnected');
        this.stopPing();

        // Don't reconnect if closed intentionally (4001 = no auth, 4003 = bad token)
        if (event.code === 4001 || event.code === 4003) {
          console.log('[WS] Auth failure — not reconnecting');
          return;
        }

        this.scheduleReconnect();
      };

      this.socket.onerror = (event) => {
        console.error('[WS] Error:', event);
      };
    } catch (err) {
      console.error('[WS] Connection failed:', err);
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server.
   */
  disconnect(): void {
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPing();

    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }

    this.joinedRooms.clear();
    this._roomUsers.clear();
    this.setStatus('disconnected');
  }

  /**
   * Join a room (document).
   */
  joinRoom(roomId: string): void {
    console.log('[WS] Joining room:', roomId);
    this.joinedRooms.add(roomId);
    this.send({ type: 'join-room', roomId });
  }

  /**
   * Leave a room.
   */
  leaveRoom(roomId: string): void {
    this.joinedRooms.delete(roomId);
    this._roomUsers.delete(roomId);
    this.send({ type: 'leave-room', roomId });
  }

  /**
   * Send a message to a room.
   */
  sendToRoom(roomId: string, payload: unknown, type: WSMessageType = 'room-message'): void {
    this.send({ type, roomId, payload });
  }

  /**
   * Subscribe to messages of a specific type.
   */
  on(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(type)?.delete(handler);
    };
  }

  /**
   * Subscribe to connection status changes.
   */
  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    // Immediately call with current status
    handler(this._status);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  // ── Private methods ──

  public send(message: WSMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      if (message.type !== 'ping' && message.type !== 'pong') {
        console.log(`[WS] Sending ${message.type}:`, message);
      }
      this.socket.send(JSON.stringify({ ...message, timestamp: new Date().toISOString() }));
    }
  }

  private handleMessage(message: WSMessage): void {
    // Handle internal messages
    switch (message.type) {
      case 'room-users':
        if (message.roomId && Array.isArray(message.payload)) {
          this._roomUsers.set(message.roomId, message.payload as Array<{ userId: string; username: string }>);
        }
        break;

      case 'user-joined':
        if (message.roomId) {
          const users = this._roomUsers.get(message.roomId) || [];
          const newUser = message.payload as { userId: string; username: string };
          if (!users.find((u) => u.userId === newUser.userId)) {
            users.push(newUser);
            this._roomUsers.set(message.roomId, users);
          }
        }
        break;

      case 'user-left':
        if (message.roomId) {
          const users = this._roomUsers.get(message.roomId) || [];
          const leftUser = message.payload as { userId: string; username: string };
          this._roomUsers.set(
            message.roomId,
            users.filter((u) => u.userId !== leftUser.userId)
          );
        }
        break;

      case 'pong':
        // Heartbeat response — connection is alive
        break;

      case 'error':
        console.error('[WS] Server error:', message.payload);
        break;
    }

    // Dispatch to registered handlers
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message);
        } catch (err) {
          console.error(`[WS] Handler error for ${message.type}:`, err);
        }
      }
    }

    // Also dispatch to wildcard '*' handlers
    const wildcardHandlers = this.messageHandlers.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler(message);
        } catch (err) {
          console.error('[WS] Wildcard handler error:', err);
        }
      }
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status;
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WS] Max reconnect attempts reached');
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
    this.reconnectAttempts++;

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, 25_000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

// Singleton instance
export const wsService = new WebSocketService();
