import type { Node, Edge } from 'reactflow';
import type { LayerMap } from './layerStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export interface NodeDiff {
  id: string;
  status: DiffStatus;
  /** Node as it exists in the base (left) project; undefined if added */
  left?: Node;
  /** Node as it exists in the modified (right) project; undefined if removed */
  right?: Node;
}

export interface EdgeDiff {
  id: string;
  status: DiffStatus;
  left?: Edge;
  right?: Edge;
}

export interface LayerDiff {
  layerId: string;
  status: DiffStatus;
  leftName: string;
  rightName: string;
  nodeDiffs: NodeDiff[];
  edgeDiffs: EdgeDiff[];
  counts: {
    added: number;
    removed: number;
    modified: number;
    total: number;
  };
}

export interface ProjectDiff {
  layers: LayerDiff[];
  counts: {
    added: number;
    removed: number;
    modified: number;
    total: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nodeModified(l: Node, r: Node): boolean {
  return (
    l.type !== r.type ||
    Math.round(l.position.x) !== Math.round(r.position.x) ||
    Math.round(l.position.y) !== Math.round(r.position.y) ||
    JSON.stringify(l.data) !== JSON.stringify(r.data) ||
    JSON.stringify(l.style) !== JSON.stringify(r.style)
  );
}

function edgeModified(l: Edge, r: Edge): boolean {
  return (
    l.source !== r.source ||
    l.target !== r.target ||
    l.label !== r.label ||
    JSON.stringify(l.style) !== JSON.stringify(r.style) ||
    JSON.stringify(l.markerEnd) !== JSON.stringify(r.markerEnd) ||
    JSON.stringify(l.markerStart) !== JSON.stringify(r.markerStart)
  );
}

function diffByIdMap<T>(
  leftMap: Record<string, T>,
  rightMap: Record<string, T>,
  isModified: (l: T, r: T) => boolean,
): { id: string; status: DiffStatus; left?: T; right?: T }[] {
  const allIds = Array.from(new Set([...Object.keys(leftMap), ...Object.keys(rightMap)]));
  const result: { id: string; status: DiffStatus; left?: T; right?: T }[] = [];

  for (const id of allIds) {
    const l = leftMap[id];
    const r = rightMap[id];
    if (l && !r) {
      result.push({ id, status: 'removed', left: l });
    } else if (!l && r) {
      result.push({ id, status: 'added', right: r });
    } else if (l && r) {
      result.push({ id, status: isModified(l, r) ? 'modified' : 'unchanged', left: l, right: r });
    }
  }

  return result;
}

// ─── Main diff function ───────────────────────────────────────────────────────

export function diffProjects(leftLayers: LayerMap, rightLayers: LayerMap): ProjectDiff {
  const allLayerIds = Array.from(new Set([...Object.keys(leftLayers), ...Object.keys(rightLayers)]));
  const layerDiffs: LayerDiff[] = [];

  for (const layerId of allLayerIds) {
    const leftLayer = leftLayers[layerId];
    const rightLayer = rightLayers[layerId];

    const leftName = leftLayer?.name ?? '(not present)';
    const rightName = rightLayer?.name ?? '(not present)';

    // Build id→item maps for fast lookup
    const leftNodeMap: Record<string, Node> = {};
    for (const n of leftLayer?.nodes ?? []) leftNodeMap[n.id] = n;
    const rightNodeMap: Record<string, Node> = {};
    for (const n of rightLayer?.nodes ?? []) rightNodeMap[n.id] = n;

    const leftEdgeMap: Record<string, Edge> = {};
    for (const e of leftLayer?.edges ?? []) leftEdgeMap[e.id] = e;
    const rightEdgeMap: Record<string, Edge> = {};
    for (const e of rightLayer?.edges ?? []) rightEdgeMap[e.id] = e;

    const nodeDiffs = diffByIdMap(leftNodeMap, rightNodeMap, nodeModified) as NodeDiff[];
    const edgeDiffs = diffByIdMap(leftEdgeMap, rightEdgeMap, edgeModified) as EdgeDiff[];

    const counts = { added: 0, removed: 0, modified: 0, total: 0 };
    for (const d of [...nodeDiffs, ...edgeDiffs]) {
      if (d.status === 'added') counts.added++;
      else if (d.status === 'removed') counts.removed++;
      else if (d.status === 'modified') counts.modified++;
    }
    counts.total = counts.added + counts.removed + counts.modified;

    // Determine layer-level status
    let layerStatus: DiffStatus;
    if (!leftLayer) {
      layerStatus = 'added';
    } else if (!rightLayer) {
      layerStatus = 'removed';
    } else if (counts.total > 0 || leftLayer.name !== rightLayer.name) {
      layerStatus = 'modified';
    } else {
      layerStatus = 'unchanged';
    }

    layerDiffs.push({ layerId, status: layerStatus, leftName, rightName, nodeDiffs, edgeDiffs, counts });
  }

  // Sort: root first, then by name
  layerDiffs.sort((a, b) => {
    if (a.layerId === 'root') return -1;
    if (b.layerId === 'root') return 1;
    return a.leftName.localeCompare(b.leftName);
  });

  const counts = {
    added: layerDiffs.filter((l) => l.status === 'added').length,
    removed: layerDiffs.filter((l) => l.status === 'removed').length,
    modified: layerDiffs.filter((l) => l.status === 'modified').length,
    total: 0,
  };
  counts.total = counts.added + counts.removed + counts.modified;

  return { layers: layerDiffs, counts };
}
