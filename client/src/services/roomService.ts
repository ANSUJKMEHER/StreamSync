const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export interface Room {
  id: string;
  name: string;
  ownerId: string;
  isPublic: boolean;
  publicAccess: 'VIEW' | 'EDIT';
  createdAt: string;
  githubRepo?: string | null;
  githubBranch?: string | null;
  access?: 'OWNER' | 'VIEW' | 'EDIT'; // Injected by GET /:id based on user
  _count?: {
    files: number;
  };
}

const getHeaders = (token?: string | null) => ({
  'Content-Type': 'application/json',
  ...(token && { Authorization: `Bearer ${token}` }),
});

export const roomService = {
  async getRooms(token: string): Promise<Room[]> {
    const res = await fetch(`${API_BASE}/api/v1/rooms`, {
      headers: getHeaders(token),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  },

  async getRoom(id: string, token?: string | null): Promise<Room> {
    const res = await fetch(`${API_BASE}/api/v1/rooms/${id}`, {
      headers: getHeaders(token),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  },

  async createRoom(name: string, token: string): Promise<Room> {
    const res = await fetch(`${API_BASE}/api/v1/rooms`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  },

  async updateRoom(id: string, data: Partial<Room>, token: string): Promise<Room> {
    const res = await fetch(`${API_BASE}/api/v1/rooms/${id}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  },

  async deleteRoom(id: string, token: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/rooms/${id}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
  }
};

