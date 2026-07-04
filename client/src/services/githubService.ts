import type { Room } from './roomService';

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  updated_at: string;
  description: string;
}

const API_BASE = (import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://streamsync-cxox.onrender.com')).replace(/\/$/, '');

const getHeaders = (token?: string | null) => ({
  'Content-Type': 'application/json',
  ...(token && { Authorization: `Bearer ${token}` }),
});

export const githubService = {
  async getUserRepos(token: string): Promise<GithubRepo[]> {
    const res = await fetch(`${API_BASE}/api/v1/github/repos`, {
      method: 'GET',
      headers: getHeaders(token),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  },

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

