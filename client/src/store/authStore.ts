import { create } from 'zustand';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'streamsync_token';
const USER_KEY = 'streamsync_user';

interface AuthUser {
  id: string;
  username: string;
  createdAt: string;
  avatarUrl?: string;
  githubId?: string;
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  restoreSession: () => Promise<void>;
  clearError: () => void;
  setAuth: (user: AuthUser, token: string) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (username: string, password: string): Promise<boolean> => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();

      if (!json.success) {
        set({ isLoading: false, error: json.error || 'Login failed' });
        return false;
      }

      const { user, token } = json.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false, error: null });
      return true;
    } catch (err) {
      set({ isLoading: false, error: 'Connection failed. Is the server running?' });
      return false;
    }
  },

  register: async (username: string, password: string): Promise<boolean> => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();

      if (!json.success) {
        set({ isLoading: false, error: json.error || 'Registration failed' });
        return false;
      }

      const { user, token } = json.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false, error: null });
      return true;
    } catch (err) {
      set({ isLoading: false, error: 'Connection failed. Is the server running?' });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },

  restoreSession: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);

    if (!token || !userStr) {
      set({ isAuthenticated: false });
      return;
    }

    try {
      // Validate token with server
      const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (json.success) {
        set({ user: json.data, token, isAuthenticated: true });
      } else {
        // Token expired or invalid
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        set({ isAuthenticated: false });
      }
    } catch {
      // Server unreachable — use cached user data
      try {
        const user = JSON.parse(userStr);
        set({ user, token, isAuthenticated: true });
      } catch {
        set({ isAuthenticated: false });
      }
    }
  },

  clearError: () => set({ error: null }),

  setAuth: (user: AuthUser, token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user, token, isAuthenticated: true, error: null });
  }
}));
