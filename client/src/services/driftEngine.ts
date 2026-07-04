import type { CanvasShape, CanvasArrow } from '../store/canvasStore';

export interface DriftEdge {
  id: string;
  fromFileId: string;
  toFileId: string;
  fromShapeId?: string;
  toShapeId?: string;
  type: 'missing-arrow' | 'stale-arrow';
  importStatement?: string;
}

interface FileContent {
  id: string;
  name: string;    // e.g. "src/utils/helpers.ts"
  content: string;
}

// Regex-based import extractor. Handles:
//   import { x } from './foo'
//   import x from '../bar'
//   const x = require('./baz')
const IMPORT_REGEX = /(?:import\s+.*?\s+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

/**
 * Parse all import relationships from a set of files.
 * Returns a Map<fileId, Set<importedFileId>>
 */
export function parseImportGraph(files: FileContent[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  
  // Build a lookup: normalized file path -> file ID
  const pathToId = new Map<string, string>();
  for (const file of files) {
    pathToId.set(file.name, file.id);
    // Also register without extension for extensionless imports
    const noExt = file.name.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '');
    pathToId.set(noExt, file.id);
    // Register with /index stripped
    if (noExt.endsWith('/index')) {
      pathToId.set(noExt.replace(/\/index$/, ''), file.id);
    }
  }

  for (const file of files) {
    const imports = new Set<string>();
    let match: RegExpExecArray | null;
    
    // Reset regex state
    IMPORT_REGEX.lastIndex = 0;
    
    while ((match = IMPORT_REGEX.exec(file.content)) !== null) {
      const importPath = match[1] || match[2];
      if (!importPath) continue;
      
      // Skip external packages (no relative path)
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) continue;
      
      // Resolve relative path against the importing file's directory
      const importerDir = file.name.includes('/')
        ? file.name.substring(0, file.name.lastIndexOf('/'))
        : '';
      const resolved = resolvePath(importerDir, importPath);
      
      const targetId = pathToId.get(resolved);
      if (targetId && targetId !== file.id) {
        imports.add(targetId);
      }
    }
    
    if (imports.size > 0) {
      graph.set(file.id, imports);
    }
  }
  
  return graph;
}

/**
 * Extract the dependency graph that the canvas arrows represent.
 * Only considers shapes that have a fileId (i.e., linked to a code file).
 * Returns Map<fromFileId, Set<toFileId>>
 */
export function extractCanvasArrowGraph(
  shapes: CanvasShape[],
  arrows: CanvasArrow[]
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  
  // Build shapeId -> fileId lookup
  const shapeToFile = new Map<string, string>();
  for (const shape of shapes) {
    if (shape.fileId) {
      shapeToFile.set(shape.id, shape.fileId);
    }
  }
  
  for (const arrow of arrows) {
    const fromFileId = shapeToFile.get(arrow.fromId);
    const toFileId = shapeToFile.get(arrow.toId);
    
    // Only count arrows where BOTH endpoints are linked to files
    if (fromFileId && toFileId) {
      if (!graph.has(fromFileId)) {
        graph.set(fromFileId, new Set());
      }
      graph.get(fromFileId)!.add(toFileId);
    }
  }
  
  return graph;
}

/**
 * Compare the code import graph against the canvas arrow graph.
 * Returns a list of drift edges.
 */
export function computeDrift(
  importGraph: Map<string, Set<string>>,
  arrowGraph: Map<string, Set<string>>,
  shapes: CanvasShape[]
): DriftEdge[] {
  const drifts: DriftEdge[] = [];
  
  // Build fileId -> shapeId reverse lookup
  const fileToShape = new Map<string, string>();
  for (const shape of shapes) {
    if (shape.fileId) {
      fileToShape.set(shape.fileId, shape.id);
    }
  }
  
  // 1. Find "missing arrows" - import exists in code, no arrow on canvas
  for (const [fromFileId, importedFiles] of importGraph) {
    const arrowTargets = arrowGraph.get(fromFileId) || new Set();
    
    for (const toFileId of importedFiles) {
      // Both files must have canvas nodes for this drift to be actionable
      if (!fileToShape.has(fromFileId) || !fileToShape.has(toFileId)) continue;
      
      if (!arrowTargets.has(toFileId)) {
        drifts.push({
          id: `drift-missing-${fromFileId}-${toFileId}`,
          fromFileId,
          toFileId,
          fromShapeId: fileToShape.get(fromFileId),
          toShapeId: fileToShape.get(toFileId),
          type: 'missing-arrow',
        });
      }
    }
  }
  
  // 2. Find "stale arrows" - arrow on canvas, no import in code
  for (const [fromFileId, arrowTargets] of arrowGraph) {
    const importTargets = importGraph.get(fromFileId) || new Set();
    
    for (const toFileId of arrowTargets) {
      if (!importTargets.has(toFileId)) {
        drifts.push({
          id: `drift-stale-${fromFileId}-${toFileId}`,
          fromFileId,
          toFileId,
          fromShapeId: fileToShape.get(fromFileId),
          toShapeId: fileToShape.get(toFileId),
          type: 'stale-arrow',
        });
      }
    }
  }
  
  return drifts;
}

/**
 * Simple path resolution for relative imports.
 * Handles './' and '../' segments.
 */
function resolvePath(base: string, relative: string): string {
  const baseParts = base.split('/').filter(Boolean);
  const relParts = relative.split('/').filter(Boolean);
  
  for (const part of relParts) {
    if (part === '.') continue;
    if (part === '..') {
      baseParts.pop();
    } else {
      baseParts.push(part);
    }
  }
  
  return baseParts.join('/');
}
