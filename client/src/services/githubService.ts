import type { Room } from './roomService';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const getHeaders = (token?: string | null) => ({
  'Content-Type': 'application/json',
  ...(token && { Authorization: `Bearer ${token}` }),
});

export const githubService = {
  async importRepo(repo: string, branch: string, pat: string, token: string): Promise<Room> {
    const res = await fetch(`${API_BASE}/api/v1/github/import`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ repo, branch, pat }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  },

  async pushRepo(roomId: string, commitMessage: string, pat: string, token: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/github/push`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ roomId, commitMessage, pat }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
  }
};
