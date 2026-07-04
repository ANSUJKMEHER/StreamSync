import { create } from 'zustand';
import type { FileItem, CursorPosition } from '../types';
import { useAuthStore } from './authStore';

const API_BASE = (import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://streamsync-cxox.onrender.com')).replace(/\/$/, '');

/** Helper to build headers with auth token */
function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface FileStore {
  // State
  files: FileItem[];
  openFileIds: string[];
  activeFileId: string | null;
  modifiedFileIds: Set<string>;
  cursorPosition: CursorPosition;
  isLoading: boolean;
  isSidebarOpen: boolean;
  sidebarWidth: number;

  activeFolderPath: string | null;

  // Actions
  fetchFiles: (roomId: string) => Promise<void>;
  openFile: (id: string) => void;
  closeFile: (id: string) => void;
  setActiveFile: (id: string) => void;
  setActiveFolderPath: (path: string | null) => void;
  updateFileContent: (id: string, content: string) => void;
  saveFile: (id: string) => Promise<void>;
  createFile: (roomId: string, name: string, content?: string) => Promise<string | undefined>;
  createFolder: (roomId: string, name: string) => Promise<string | undefined>;
  deleteFile: (id: string) => Promise<void>;
  renameFile: (id: string, newName: string) => Promise<void>;
  setCursorPosition: (pos: CursorPosition) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
}

export const useFileStore = create<FileStore>((set, get) => ({
  // Initial state
  files: [],
  openFileIds: [],
  activeFileId: null,
  activeFolderPath: null,
  modifiedFileIds: new Set(),
  cursorPosition: { lineNumber: 1, column: 1 },
  isLoading: false,
  isSidebarOpen: true,
  sidebarWidth: 260,

  // Fetch all files from server for a specific room
  fetchFiles: async (roomId: string) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/api/v1/files/room/${roomId}`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success) {
        set({ files: json.data });
        // Auto-open first file if nothing is open
        const state = get();
        if (state.openFileIds.length === 0 && json.data.length > 0) {
          const firstFile = json.data[0];
          set({ openFileIds: [firstFile.id], activeFileId: firstFile.id });
        }
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  // Open a file tab
  openFile: (id: string) => {
    const state = get();
    if (!state.openFileIds.includes(id)) {
      set({ openFileIds: [...state.openFileIds, id], activeFileId: id });
    } else {
      set({ activeFileId: id });
    }
  },

  // Close a file tab
  closeFile: (id: string) => {
    const state = get();
    const newOpenIds = state.openFileIds.filter((fid) => fid !== id);
    const newModified = new Set(state.modifiedFileIds);
    newModified.delete(id);

    let newActiveId = state.activeFileId;
    if (state.activeFileId === id) {
      const idx = state.openFileIds.indexOf(id);
      newActiveId = newOpenIds[Math.min(idx, newOpenIds.length - 1)] || null;
    }

    set({
      openFileIds: newOpenIds,
      activeFileId: newActiveId,
      modifiedFileIds: newModified,
    });
  },

  // Set active tab
  setActiveFile: (id: string) => set({ activeFileId: id }),
  setActiveFolderPath: (path: string | null) => set({ activeFolderPath: path }),

  // Update file content locally (marks as modified)
  updateFileContent: (id: string, content: string) => {
    const state = get();
    const newModified = new Set(state.modifiedFileIds);
    newModified.add(id);

    set({
      files: state.files.map((f) =>
        f.id === id ? { ...f, content, updatedAt: new Date().toISOString() } : f
      ),
      modifiedFileIds: newModified,
    });
  },

  // Save file to server
  saveFile: async (id: string) => {
    const state = get();
    const file = state.files.find((f) => f.id === id);
    if (!file) return;

    // Get the latest authoritative content from the CRDT, rather than stale Zustand state
    let contentToSave = file.content;
    try {
      // Need to import yjsService inside the function to avoid circular dependency
      // if fileStore is imported by yjsService (which it currently isn't, but safe practice)
      const { yjsService } = await import('../services/yjsService');
      contentToSave = yjsService.getTextContent(file.id);
    } catch (e) {
      console.error('Failed to get content from Yjs, using fallback state', e);
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/files/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content: contentToSave }),
      });
      const json = await res.json();
      if (json.success) {
        const newModified = new Set(state.modifiedFileIds);
        newModified.delete(id);
        set({ 
          modifiedFileIds: newModified,
          files: state.files.map((f) =>
            f.id === id ? { ...f, content: contentToSave } : f
          ),
        });
      }
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  },

  // Create new file
  createFile: async (roomId: string, name: string, content?: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/files`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ roomId, name, content: content || '' }),
      });
      const json = await res.json();
      if (json.success) {
        const state = get();
        set({
          files: [...state.files, json.data],
          openFileIds: [...state.openFileIds, json.data.id],
          activeFileId: json.data.id,
        });
        return json.data.id;
      }
    } catch (err) {
      console.error('Failed to create file:', err);
    }
  },

  // Create new folder
  createFolder: async (roomId: string, name: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/files`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ roomId, name, content: '', isFolder: true }),
      });
      const json = await res.json();
      if (json.success) {
        const state = get();
        set({
          files: [...state.files, json.data],
        });
        return json.data.id;
      }
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  },

  // Delete file
  deleteFile: async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/files/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success) {
        get().closeFile(id);
        set({ files: get().files.filter((f) => f.id !== id) });
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  },

  // Rename file
  renameFile: async (id: string, newName: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/files/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: newName }),
      });
      const json = await res.json();
      if (json.success) {
        set({
          files: get().files.map((f) =>
            f.id === id ? { ...f, name: newName } : f
          ),
        });
      }
    } catch (err) {
      console.error('Failed to rename file:', err);
    }
  },

  // Cursor position
  setCursorPosition: (pos: CursorPosition) => set({ cursorPosition: pos }),

  // Sidebar
  toggleSidebar: () => set({ isSidebarOpen: !get().isSidebarOpen }),
  setSidebarWidth: (width: number) => set({ sidebarWidth: width }),
}));

