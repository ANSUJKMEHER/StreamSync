import { create } from 'zustand';
import type { DriftEdge } from '../services/driftEngine';
export type { DriftEdge };

interface DriftState {
  driftEdges: DriftEdge[];
  isAnalyzing: boolean;
  lastAnalyzedAt: number | null;
  setDriftEdges: (edges: DriftEdge[]) => void;
  setAnalyzing: (v: boolean) => void;
}

export const useDriftStore = create<DriftState>((set) => ({
  driftEdges: [],
  isAnalyzing: false,
  lastAnalyzedAt: null,
  setDriftEdges: (edges) => set({ driftEdges: edges, lastAnalyzedAt: Date.now() }),
  setAnalyzing: (v) => set({ isAnalyzing: v }),
}));
