import dagre from 'dagre';
import type { CanvasShape, CanvasArrow } from '../store/canvasStore';

export interface LayoutOptions {
  direction?: 'TB' | 'LR';
  nodeSep?: number;
  rankSep?: number;
  marginX?: number;
  marginY?: number;
}

export const FLOWCHART_PALETTE = {
  start: {
    fill: 'rgba(16, 185, 129, 0.2)',
    stroke: '#10b981',
    textColor: '#ecfdf5',
    badge: 'START',
  },
  end: {
    fill: 'rgba(239, 68, 68, 0.2)',
    stroke: '#f87171',
    textColor: '#fef2f2',
    badge: 'END',
  },
  decision: {
    fill: 'rgba(245, 158, 11, 0.18)',
    stroke: '#fbbf24',
    textColor: '#fffbeb',
    badge: 'IF',
  },
  process: {
    fill: 'rgba(99, 102, 241, 0.18)',
    stroke: '#818cf8',
    textColor: '#f5f3ff',
    badge: 'ACTION',
  },
  io: {
    fill: 'rgba(6, 182, 212, 0.18)',
    stroke: '#38bdf8',
    textColor: '#f0f9ff',
    badge: 'I/O',
  },
};

/**
 * Infer the semantic category of a node based on its label and attributes
 */
export function inferNodeCategory(shape: Partial<CanvasShape>): 'start' | 'end' | 'decision' | 'process' | 'io' {
  if (shape.category) return shape.category;
  const label = (shape.label || '').trim().toLowerCase();

  if (/\b(start|begin|entry|init)\b/i.test(label) || label.includes('start')) {
    return 'start';
  }
  if (/\b(end|stop|exit|terminate|return|done)\b/i.test(label) || label.includes('end')) {
    return 'end';
  }
  if (label.includes('?') || /\b(if|else|condition|while|for|check|switch|case|is)\b/i.test(label)) {
    return 'decision';
  }
  if (
    /\b(cout|cin|print|printf|println|scan|read|write|log|input|output|display|prompt)\b/i.test(label) ||
    label.includes('<<') ||
    label.includes('>>')
  ) {
    return 'io';
  }
  return 'process';
}

/**
 * Execute Dagre hierarchical layout on shapes and arrows
 */
export function layoutFlowchart(
  rawShapes: (Partial<CanvasShape> & { id: string })[],
  rawArrows: (Partial<CanvasArrow> & { fromId: string; toId: string })[],
  options: LayoutOptions = {}
): { shapes: CanvasShape[]; arrows: CanvasArrow[] } {
  if (rawShapes.length === 0) {
    return { shapes: [], arrows: [] };
  }

  const direction = options.direction || 'TB';
  const nodeSep = options.nodeSep ?? 65;
  const rankSep = options.rankSep ?? 85;
  const marginX = options.marginX ?? 160;
  const marginY = options.marginY ?? 100;

  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({
    rankdir: direction,
    nodesep: nodeSep,
    ranksep: rankSep,
    marginx: marginX,
    marginy: marginY,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Step 1: Normalize and measure all shapes
  const preparedShapes: CanvasShape[] = rawShapes.map((s, idx) => {
    const id = s.id || `node-${Date.now()}-${idx}`;
    const label = s.label || 'Node';
    const category = inferNodeCategory(s);
    const theme = FLOWCHART_PALETTE[category];

    let type = s.type;
    if (!type) {
      if (category === 'start' || category === 'end') type = 'circle';
      else if (category === 'decision') type = 'diamond';
      else type = 'rect';
    }

    let width = s.width || 0;
    let height = s.height || 0;

    if (!width || !height) {
      const charWidth = 8.5;
      if (type === 'diamond') {
        width = Math.max(160, Math.ceil(label.length * charWidth + 56));
        height = Math.max(76, Math.ceil(width * 0.52));
      } else if (type === 'circle') {
        width = Math.max(130, Math.ceil(label.length * 8 + 36));
        height = 52;
      } else {
        width = Math.max(145, Math.ceil(label.length * 8.2 + 38));
        height = 56;
      }
    }

    return {
      id,
      type: type as 'rect' | 'circle' | 'diamond',
      x: s.x || 0,
      y: s.y || 0,
      width,
      height,
      label,
      fill: s.fill && !s.fill.startsWith('#') && s.fill.includes('rgba') ? s.fill : theme.fill,
      stroke: s.stroke || theme.stroke,
      category,
      fileId: s.fileId,
    };
  });

  // Step 2: Register nodes with Dagre
  preparedShapes.forEach((shape) => {
    g.setNode(shape.id, {
      width: shape.width,
      height: shape.height,
    });
  });

  // Step 3: Register edges with Dagre
  rawArrows.forEach((arrow, idx) => {
    const edgeName = arrow.id || `edge-${idx}`;
    if (g.hasNode(arrow.fromId) && g.hasNode(arrow.toId)) {
      g.setEdge(arrow.fromId, arrow.toId, {}, edgeName);
    }
  });

  // Step 4: Run hierarchical layout
  dagre.layout(g);

  // Step 5: Extract laid-out shape positions (Dagre gives center coordinates)
  const positionedShapes: CanvasShape[] = preparedShapes.map((shape) => {
    const dagreNode = g.node(shape.id);
    if (!dagreNode) return shape;
    return {
      ...shape,
      x: Math.round(dagreNode.x - shape.width / 2),
      y: Math.round(dagreNode.y - shape.height / 2),
    };
  });

  // Step 6: Extract smoothed multi-point edge routing from Dagre
  const routedArrows: CanvasArrow[] = rawArrows.map((arrow, idx) => {
    const id = arrow.id || `arrow-${Date.now()}-${idx}`;
    const edgeName = arrow.id || `edge-${idx}`;
    const dagreEdge = g.edge(arrow.fromId, arrow.toId, edgeName) || g.edge(arrow.fromId, arrow.toId);

    let points: number[] | undefined;
    if (dagreEdge && Array.isArray(dagreEdge.points) && dagreEdge.points.length >= 2) {
      points = dagreEdge.points.flatMap((p) => [Math.round(p.x), Math.round(p.y)]);
    }

    return {
      id,
      fromId: arrow.fromId,
      toId: arrow.toId,
      label: arrow.label,
      points,
      color: arrow.color,
    };
  });

  return { shapes: positionedShapes, arrows: routedArrows };
}

/**
 * Computes intersection between a line from shape center towards target point and the shape boundary
 */
export function getShapeBoundaryPoint(
  shape: CanvasShape,
  targetPoint: { x: number; y: number }
): { x: number; y: number } {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const dx = targetPoint.x - cx;
  const dy = targetPoint.y - cy;

  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return { x: cx, y: cy };
  }

  if (shape.type === 'circle') {
    // If shape is a pill (width > height), approximate rectangle with rounded caps
    if (shape.width > shape.height * 1.25) {
      const halfW = shape.width / 2;
      const halfH = shape.height / 2;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx * halfH > absDy * halfW) {
        return {
          x: cx + (dx > 0 ? halfW : -halfW),
          y: cy + dy * (halfW / absDx),
        };
      } else {
        return {
          x: cx + dx * (halfH / absDy),
          y: cy + (dy > 0 ? halfH : -halfH),
        };
      }
    }
    const radius = Math.min(shape.width, shape.height) / 2;
    const angle = Math.atan2(dy, dx);
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  }

  if (shape.type === 'diamond') {
    const halfW = shape.width / 2;
    const halfH = shape.height / 2;
    const denom = Math.abs(dx) * halfH + Math.abs(dy) * halfW;
    if (denom === 0) return { x: cx, y: cy };
    const t = (halfW * halfH) / denom;
    return {
      x: cx + dx * t,
      y: cy + dy * t,
    };
  }

  // Rect boundary
  const halfW = shape.width / 2;
  const halfH = shape.height / 2;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx * halfH > absDy * halfW) {
    const sx = dx > 0 ? halfW : -halfW;
    const sy = dy * (halfW / absDx);
    return { x: cx + sx, y: cy + sy };
  } else {
    const sx = dx * (halfH / absDy);
    const sy = dy > 0 ? halfH : -halfH;
    return { x: cx + sx, y: cy + sy };
  }
}
