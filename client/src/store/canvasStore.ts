import { create } from 'zustand';

export interface CanvasShape {
  id: string;
  type: 'rect' | 'circle' | 'diamond';
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  category?: 'start' | 'end' | 'decision' | 'process' | 'io';
  fileId?: string; 
}

export interface CanvasArrow {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
  points?: number[];
  color?: string;
}

export type CanvasTool = 'select' | 'rect' | 'circle' | 'diamond' | 'arrow';

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

const MODERN_THEME_PALETTE = [
  { fill: 'rgba(99, 102, 241, 0.2)', stroke: '#818cf8' }, // indigo
  { fill: 'rgba(6, 182, 212, 0.2)', stroke: '#38bdf8' },  // cyan
  { fill: 'rgba(16, 185, 129, 0.2)', stroke: '#10b981' }, // emerald
  { fill: 'rgba(245, 158, 11, 0.2)', stroke: '#fbbf24' }, // amber
  { fill: 'rgba(168, 85, 247, 0.2)', stroke: '#c084fc' }, // purple
  { fill: 'rgba(236, 72, 153, 0.2)', stroke: '#f472b6' }, // pink
];

let colorIdx = 0;
export function nextShapeColor(): { fill: string; stroke: string } {
  const c = MODERN_THEME_PALETTE[colorIdx % MODERN_THEME_PALETTE.length];
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
