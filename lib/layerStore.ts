import type { Node, Edge } from 'reactflow';

export interface Layer {
  id: string;
  name: string;
  description?: string;
  parentLayerId: string | null;
  parentNodeId: string | null; // which node was drilled into
  nodes: Node[];
  edges: Edge[];
  createdAt: number;
}

export type LayerMap = Record<string, Layer>;

export const ROOT_LAYER_ID = 'root';
const STORAGE_KEY = 'drafter_layers';

export function loadAllLayers(): LayerMap {
  if (typeof window === 'undefined') return makeInitialLayers();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LayerMap;
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch {
    // fall through
  }
  return makeInitialLayers();
}

export function saveAllLayers(layers: LayerMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layers));
  } catch {
    // ignore quota errors
  }
}

export function makeInitialLayers(): LayerMap {
  const root: Layer = {
    id: ROOT_LAYER_ID,
    name: 'Root',
    parentLayerId: null,
    parentNodeId: null,
    nodes: [],
    edges: [],
    createdAt: Date.now(),
  };
  return { [ROOT_LAYER_ID]: root };
}

export function createChildLayer(
  parentLayerId: string,
  parentNodeId: string,
  name: string,
): Layer {
  return {
    id: `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    parentLayerId,
    parentNodeId,
    nodes: [],
    edges: [],
    createdAt: Date.now(),
  };
}

/** Walk parent links to build the breadcrumb path from root to layerId */
export function getLayerPath(layers: LayerMap, layerId: string): Layer[] {
  const path: Layer[] = [];
  let currentId: string | null = layerId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    const layer: Layer | undefined = layers[currentId];
    if (!layer) break;
    visited.add(currentId);
    path.unshift(layer);
    currentId = layer.parentLayerId;
  }
  return path;
}

/** Update name / description of a layer, returning a new LayerMap */
export function updateLayer(
  layers: LayerMap,
  layerId: string,
  updates: Partial<Pick<Layer, 'name' | 'description'>>,
): LayerMap {
  if (!layers[layerId]) return layers;
  return { ...layers, [layerId]: { ...layers[layerId], ...updates } };
}

/** Find a direct child layer for a given node, if one exists */
export function findChildLayer(
  layers: LayerMap,
  parentLayerId: string,
  parentNodeId: string,
): Layer | undefined {
  return Object.values(layers).find(
    (l) => l.parentLayerId === parentLayerId && l.parentNodeId === parentNodeId,
  );
}
