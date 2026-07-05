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

export interface User {
  id: string;
  username: string;
  createdAt: string;
  avatarUrl?: string;
  githubId?: string;
}

export interface CursorPosition {
  lineNumber: number;
  column: number;
}

export interface EditorSelection {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface Collaborator {
  id: string;
  roomId: string;
  userId: string;
  role: 'VIEW' | 'EDIT';
  user?: Pick<User, 'username' | 'avatarUrl'>;
}

export interface RoomInvite {
  id: string;
  roomId: string;
  inviterId: string;
  targetUsername: string;
  inviteeId: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  role: 'VIEW' | 'EDIT';
  room?: { name: string, ownerId: string };
  inviter?: Pick<User, 'username' | 'avatarUrl'>;
  createdAt: string;
}
