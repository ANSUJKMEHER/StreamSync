import { create } from 'zustand';
import { wsService } from '../services/websocket';

export interface RoomUser {
  userId: string;
  username: string;
}

interface RoomState {
  activeRoomId: string | null;
  roomUsers: RoomUser[];
  setActiveRoom: (roomId: string | null) => void;
}

export const useRoomStore = create<RoomState>((set, get) => {
  // Listen to WebSocket events to keep room users in sync
  wsService.on('room-users', (msg) => {
    console.log('[roomStore] Received room-users message:', msg);
    if (msg.roomId === get().activeRoomId && Array.isArray(msg.payload)) {
      console.log('[roomStore] Updating roomUsers list:', msg.payload);
      set({ roomUsers: msg.payload as RoomUser[] });
    }
  });

  wsService.on('user-joined', (msg) => {
    console.log('[roomStore] Received user-joined message:', msg);
    if (msg.roomId === get().activeRoomId && msg.payload) {
      const newUser = msg.payload as RoomUser;
      const currentUsers = get().roomUsers;
      if (!currentUsers.find((u) => u.userId === newUser.userId)) {
        const nextUsers = [...currentUsers, newUser];
        console.log('[roomStore] Adding user to list:', newUser, 'New list:', nextUsers);
        set({ roomUsers: nextUsers });
      }
    }
  });

  wsService.on('user-left', (msg) => {
    console.log('[roomStore] Received user-left message:', msg);
    if (msg.roomId === get().activeRoomId && msg.payload) {
      const leftUser = msg.payload as RoomUser;
      const nextUsers = get().roomUsers.filter((u) => u.userId !== leftUser.userId);
      console.log('[roomStore] Removing user from list:', leftUser, 'New list:', nextUsers);
      set({ roomUsers: nextUsers });
    }
  });

  return {
    activeRoomId: null,
    roomUsers: [],
    setActiveRoom: (roomId: string | null) => {
      console.log('[roomStore] Set active room:', roomId);
      set({ activeRoomId: roomId });
      if (roomId) {
        // If we switch rooms, try to populate immediately if wsService has the data cached
        const cachedUsers = wsService.roomUsers.get(roomId) || [];
        set({ roomUsers: cachedUsers });
      } else {
        set({ roomUsers: [] });
      }
    },
  };
});
