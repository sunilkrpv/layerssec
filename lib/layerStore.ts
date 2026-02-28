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
const STORAGE_KEY = 'layers';

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

/** Create a standalone top-level layer (not tied to a specific node). */
export function createStandaloneLayer(name: string): Layer {
  return {
    id: `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    parentLayerId: ROOT_LAYER_ID,
    parentNodeId: null,
    nodes: [],
    edges: [],
    createdAt: Date.now(),
  };
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

/**
 * Collect the IDs of a layer and all its descendants (recursive).
 * Returned as a Set for O(1) membership checks.
 */
export function collectDescendantIds(layers: LayerMap, layerId: string): Set<string> {
  const ids = new Set<string>();
  function visit(id: string) {
    if (ids.has(id)) return;
    ids.add(id);
    for (const layer of Object.values(layers)) {
      if (layer.parentLayerId === id) visit(layer.id);
    }
  }
  visit(layerId);
  return ids;
}

/**
 * Delete a layer and all its descendants from the LayerMap.
 * Also clears `_childLayerId` from the parent node that linked to the deleted layer.
 * Cannot delete the root layer — returns unchanged map if attempted.
 */
export function deleteLayerCascade(layers: LayerMap, layerId: string): LayerMap {
  if (layerId === ROOT_LAYER_ID) return layers;
  const layer = layers[layerId];
  if (!layer) return layers;

  const toDelete = collectDescendantIds(layers, layerId);

  // Build a new LayerMap without the deleted layers
  const result: LayerMap = {};
  for (const [id, l] of Object.entries(layers)) {
    if (toDelete.has(id)) continue;
    result[id] = l;
  }

  // Clear _childLayerId on the parent node that pointed directly to the deleted layer
  const { parentLayerId, parentNodeId } = layer;
  if (parentLayerId && parentNodeId && result[parentLayerId]) {
    const parentLayer = result[parentLayerId];
    result[parentLayerId] = {
      ...parentLayer,
      nodes: parentLayer.nodes.map((n) => {
        if (n.id !== parentNodeId) return n;
        const data = n.data as Record<string, unknown>;
        if (data._childLayerId !== layerId) return n;
        const { _childLayerId: _removed, ...rest } = data;
        return { ...n, data: rest };
      }),
    };
  }

  return result;
}

/** Return all layers that are not attached to any node (standalone / orphaned). */
export function getOrphanedLayers(layers: LayerMap): Layer[] {
  return Object.values(layers).filter(
    (l) => l.id !== ROOT_LAYER_ID && l.parentNodeId === null,
  );
}
