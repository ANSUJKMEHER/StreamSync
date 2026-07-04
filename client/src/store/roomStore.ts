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
    if (msg.roomId === get().activeRoomId && Array.isArray(msg.payload)) {
      set({ roomUsers: msg.payload as RoomUser[] });
    }
  });

  wsService.on('user-joined', (msg) => {
    if (msg.roomId === get().activeRoomId && msg.payload) {
      const newUser = msg.payload as RoomUser;
      const currentUsers = get().roomUsers;
      if (!currentUsers.find((u) => u.userId === newUser.userId)) {
        set({ roomUsers: [...currentUsers, newUser] });
      }
    }
  });

  wsService.on('user-left', (msg) => {
    if (msg.roomId === get().activeRoomId && msg.payload) {
      const leftUser = msg.payload as RoomUser;
      set({
        roomUsers: get().roomUsers.filter((u) => u.userId !== leftUser.userId),
      });
    }
  });

  return {
    activeRoomId: null,
    roomUsers: [],
    setActiveRoom: (roomId: string | null) => {
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
