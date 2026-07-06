import { create } from 'zustand';

export interface CanvasShape {
  id: string;
  type: 'rect' | 'circle';
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  fill: string;
  fileId?: string; 
}

export interface CanvasArrow {
  id: string;
  fromId: string;
  toId: string;
}

export type CanvasTool = 'select' | 'rect' | 'circle' | 'arrow';

interface CanvasState {
  shapes: CanvasShape[];
  arrows: CanvasArrow[];
  selectedId: string | null;
  tool: CanvasTool;
  arrowStartId: string | null; // For two-click arrow creation

  // Actions
  addShape: (shape: CanvasShape) => void;
  updateShape: (id: string, updates: Partial<CanvasShape>) => void;
  deleteShape: (id: string) => void;
  addArrow: (arrow: CanvasArrow) => void;
  deleteArrow: (id: string) => void;
  setTool: (tool: CanvasTool) => void;
  setSelectedId: (id: string | null) => void;
  setArrowStartId: (id: string | null) => void;
  deleteSelected: () => void;

  // Sync
  setGraph: (shapes: CanvasShape[], arrows: CanvasArrow[]) => void;
}

const SHAPE_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#3b82f6', // blue
];

let colorIdx = 0;
export function nextShapeColor(): string {
  const c = SHAPE_COLORS[colorIdx % SHAPE_COLORS.length];
  colorIdx++;
  return c;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  shapes: [],
  arrows: [],
  selectedId: null,
  tool: 'select',
  arrowStartId: null,

  addShape: (shape) =>
    set((s) => ({ shapes: [...s.shapes, shape] })),

  updateShape: (id, updates) =>
    set((s) => ({
      shapes: s.shapes.map((sh) => (sh.id === id ? { ...sh, ...updates } : sh)),
    })),

  deleteShape: (id) =>
    set((s) => ({
      shapes: s.shapes.filter((sh) => sh.id !== id),
      arrows: s.arrows.filter((a) => a.fromId !== id && a.toId !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  addArrow: (arrow) =>
    set((s) => ({ arrows: [...s.arrows, arrow] })),

  deleteArrow: (id) =>
    set((s) => ({ arrows: s.arrows.filter((a) => a.id !== id) })),

  setTool: (tool) => set({ tool, arrowStartId: null }),

  setSelectedId: (id) => set({ selectedId: id }),

  setArrowStartId: (id) => set({ arrowStartId: id }),

  deleteSelected: () => {
    const { selectedId, shapes, arrows } = get();
    if (!selectedId) return;

    // Check if selected is a shape
    if (shapes.find((s) => s.id === selectedId)) {
      get().deleteShape(selectedId);
      return;
    }
    // Check if selected is an arrow
    if (arrows.find((a) => a.id === selectedId)) {
      get().deleteArrow(selectedId);
      set({ selectedId: null });
    }
  },

  setGraph: (shapes, arrows) => {
    set({ shapes, arrows });
  },
}));
