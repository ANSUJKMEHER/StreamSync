export interface FileItem {
  id: string;
  name: string;
  content: string;
  language: string;
  parentId: string | null;
  isFolder: boolean;
  roomId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFileRequest {
  name: string;
  roomId: string;
  content?: string;
  language?: string;
  parentId?: string | null;
  isFolder?: boolean;
}

export interface UpdateFileRequest {
  name?: string;
  content?: string;
  language?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── Auth Types ──

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface UserPublic {
  id: string;
  username: string;
  createdAt: string;
  avatarUrl?: string | null;
  githubId?: string | null;
}

export interface AuthRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: UserPublic;
  token: string;
}

export interface JwtPayload {
  userId: string;
  username: string;
}

// ── WebSocket Types ──

export type WSMessageType =
  | 'join-room'
  | 'leave-room'
  | 'room-message'
  | 'room-users'
  | 'user-joined'
  | 'user-left'
  | 'yjs-update'
  | 'yjs-sync'
  | 'awareness-update'
  | 'error'
  | 'ping'
  | 'pong';

export interface WSMessage {
  type: WSMessageType;
  roomId?: string;
  payload?: unknown;
  timestamp?: string;
}

export interface ConnectedClient {
  userId: string;
  username: string;
  socket: import('ws').WebSocket;
  rooms: Set<string>;
  isAlive: boolean;
  connectedAt: string;
}
