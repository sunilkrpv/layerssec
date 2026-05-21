// apps/frontend/lib/trustMap.ts
import type { Node } from 'reactflow';
import type { LayerMap } from './layerStore';
import type { NodeData } from './types';
import type { ProjectThreat, ThreatSeverity } from './api';

export type TrustLevel = 'internet' | 'external' | 'dmz' | 'internal' | 'custom';

export interface TrustMapCard {
  /** Globally unique card key: `${layerId}:${nodeId}` */
  key: string;
  nodeId: string;
  layerId: string;
  layerName: string;
  label: string;
  nodeType: string;
  subtitle?: string;
  containedBy: 'parent' | 'geometric';
  /** Set if this node has a drill-down child layer */
  childLayerId?: string;
}

export interface TrustMapColumn {
  boundaryId: string;
  boundaryKey: string; // `${layerId}:${boundaryId}`
  layerId: string;
  layerName: string;
  label: string;
  trustLevel: TrustLevel;
  cards: TrustMapCard[];
}

export interface TrustMapFlow {
  edgeId: string;
  layerId: string;
  sourceCardKey: string;
  targetCardKey: string;
  sourceBoundaryKey: string;
  targetBoundaryKey: string;
  threats: ProjectThreat[];
  highestSeverity: ThreatSeverity | null;
}

export interface NestedLayerSummary {
  layerId: string;
  layerName: string;
  parentNodeLabel: string;
  threatCount: number;
  highestSeverity: ThreatSeverity | null;
  severityCounts: Record<ThreatSeverity, number>;
}

export interface TrustMapView {
  /** Layer this view was built for */
  layerId: string;
  layerName: string;
  columns: TrustMapColumn[];
  flows: TrustMapFlow[];
  unboundedCards: TrustMapCard[];
  /** Total card count across all columns + unbounded */
  cardCount: number;
  /** Direct child layers reachable via drill-down nodes in this layer */
  nestedLayers: NestedLayerSummary[];
}

const TRUST_LEVEL_RANK: Record<TrustLevel, number> = {
  internet: 0,
  external: 1,
  dmz: 2,
  internal: 3,
  custom: 4,
};

const SEVERITY_RANK: Record<ThreatSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INFO: 0,
};

function normalizeTrustLevel(data: NodeData | undefined): TrustLevel {
  const raw = (data?.trustLevel ?? 'internal').toLowerCase();
  return raw === 'internet' || raw === 'external' || raw === 'dmz' || raw === 'internal' || raw === 'custom'
    ? raw
    : 'custom';
}

function nodeArea(n: Node): number {
  const w = typeof n.width === 'number' ? n.width : 0;
  const h = typeof n.height === 'number' ? n.height : 0;
  return w * h;
}

function rectContains(boundary: Node, child: Node): boolean {
  const bw = typeof boundary.width === 'number' ? boundary.width : 0;
  const bh = typeof boundary.height === 'number' ? boundary.height : 0;
  const cw = typeof child.width === 'number' ? child.width : 0;
  const ch = typeof child.height === 'number' ? child.height : 0;
  if (bw === 0 || bh === 0) return false;
  const bx1 = boundary.position.x;
  const by1 = boundary.position.y;
  const bx2 = bx1 + bw;
  const by2 = by1 + bh;
  const cx1 = child.position.x;
  const cy1 = child.position.y;
  const cx2 = cx1 + cw;
  const cy2 = cy1 + ch;
  return cx1 >= bx1 && cy1 >= by1 && cx2 <= bx2 && cy2 <= by2;
}

function makeCardKey(layerId: string, nodeId: string): string {
  return `${layerId}:${nodeId}`;
}

function deriveSubtitle(data: NodeData | undefined, nodeType: string): string | undefined {
  if (!data) return nodeType;
  if (data.technology) return data.technology;
  if (data.description && data.description.length <= 60) return data.description;
  return nodeType;
}

function buildCard(
  node: Node,
  layerId: string,
  layerName: string,
  containedBy: 'parent' | 'geometric',
): TrustMapCard {
  const data = node.data as NodeData | undefined;
  return {
    key: makeCardKey(layerId, node.id),
    nodeId: node.id,
    layerId,
    layerName,
    label: data?.label ?? node.id,
    nodeType: node.type ?? 'unknown',
    subtitle: deriveSubtitle(data, node.type ?? 'unknown'),
    containedBy,
    childLayerId: data?._childLayerId,
  };
}

/**
 * Collect threats reachable from a layer and all its descendant layers.
 * Used to roll up nested-layer severity into the parent view.
 */
function collectSubtreeThreatStats(
  layers: LayerMap,
  threats: ProjectThreat[],
  rootLayerId: string,
): { count: number; highest: ThreatSeverity | null; counts: Record<ThreatSeverity, number> } {
  const counts: Record<ThreatSeverity, number> = {
    CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0,
  };
  // Collect descendant layer ids (inclusive)
  const layerIds = new Set<string>();
  const stack = [rootLayerId];
  while (stack.length) {
    const id = stack.pop()!;
    if (layerIds.has(id)) continue;
    layerIds.add(id);
    for (const l of Object.values(layers)) {
      if (l.parentLayerId === id) stack.push(l.id);
    }
  }
  // Collect node and edge ids belonging to these layers
  const targetIds = new Set<string>();
  for (const id of layerIds) {
    const l = layers[id];
    if (!l) continue;
    for (const n of l.nodes) targetIds.add(n.id);
    for (const e of l.edges) targetIds.add(e.id);
  }
  let count = 0;
  let highest: ThreatSeverity | null = null;
  for (const t of threats) {
    if (!targetIds.has(t.targetId)) continue;
    count++;
    counts[t.severity]++;
    if (!highest || SEVERITY_RANK[t.severity] > SEVERITY_RANK[highest]) highest = t.severity;
  }
  return { count, highest, counts };
}

export function buildTrustMapView(
  layers: LayerMap,
  threats: ProjectThreat[],
  layerId: string,
): TrustMapView {
  const layer = layers[layerId];
  if (!layer) {
    return {
      layerId,
      layerName: '?',
      columns: [],
      flows: [],
      unboundedCards: [],
      cardCount: 0,
      nestedLayers: [],
    };
  }

  // 1. Boundaries within this layer
  const boundaries = layer.nodes
    .filter((n) => n.type === 'trustboundary')
    .map((node) => ({ node, layerId, layerName: layer.name }));

  // 2. For each non-boundary node in this layer, decide which boundary owns it.
  const cardByKey = new Map<string, TrustMapCard>();
  const boundaryKeyByCard = new Map<string, string>();
  const columns: TrustMapColumn[] = boundaries.map(({ node }) => ({
    boundaryId: node.id,
    boundaryKey: makeCardKey(layerId, node.id),
    layerId,
    layerName: layer.name,
    label: (node.data as NodeData | undefined)?.label ?? 'Trust Boundary',
    trustLevel: normalizeTrustLevel(node.data as NodeData | undefined),
    cards: [],
  }));
  const columnByBoundaryKey = new Map<string, TrustMapColumn>();
  for (const col of columns) columnByBoundaryKey.set(col.boundaryKey, col);

  const unbounded: TrustMapCard[] = [];

  for (const n of layer.nodes) {
    if (n.type === 'trustboundary') continue;

    // Parent rule
    if (n.parentNode) {
      const parentMatch = boundaries.find((b) => b.node.id === n.parentNode);
      if (parentMatch) {
        const card = buildCard(n, layerId, layer.name, 'parent');
        cardByKey.set(card.key, card);
        const bk = makeCardKey(layerId, parentMatch.node.id);
        boundaryKeyByCard.set(card.key, bk);
        const col = columnByBoundaryKey.get(bk);
        if (!col) { unbounded.push(card); continue; }
        col.cards.push(card);
        continue;
      }
    }

    // Geometric rule
    const containing = boundaries
      .filter((b) => rectContains(b.node, n))
      .sort((a, b) => nodeArea(a.node) - nodeArea(b.node));
    if (containing.length > 0) {
      const winner = containing[0];
      const card = buildCard(n, layerId, layer.name, 'geometric');
      cardByKey.set(card.key, card);
      const bk = makeCardKey(layerId, winner.node.id);
      boundaryKeyByCard.set(card.key, bk);
      const col = columnByBoundaryKey.get(bk);
      if (!col) { unbounded.push(card); continue; }
      col.cards.push(card);
      continue;
    }

    // Unassigned
    const orphan = buildCard(n, layerId, layer.name, 'geometric');
    cardByKey.set(orphan.key, orphan);
    unbounded.push(orphan);
  }

  // 3. Walk this layer's edges, emit cross-boundary flows + threats.
  const threatsByTarget = new Map<string, ProjectThreat[]>();
  for (const t of threats) {
    const list = threatsByTarget.get(t.targetId) ?? [];
    list.push(t);
    threatsByTarget.set(t.targetId, list);
  }

  const flows: TrustMapFlow[] = [];
  for (const edge of layer.edges) {
    const srcKey = makeCardKey(layerId, edge.source);
    const tgtKey = makeCardKey(layerId, edge.target);
    const srcBoundary = boundaryKeyByCard.get(srcKey);
    const tgtBoundary = boundaryKeyByCard.get(tgtKey);
    if (!srcBoundary || !tgtBoundary || srcBoundary === tgtBoundary) continue;

    const edgeThreats = threatsByTarget.get(edge.id) ?? [];
    let highest: ThreatSeverity | null = null;
    for (const t of edgeThreats) {
      if (!highest || SEVERITY_RANK[t.severity] > SEVERITY_RANK[highest]) highest = t.severity;
    }

    flows.push({
      edgeId: edge.id,
      layerId,
      sourceCardKey: srcKey,
      targetCardKey: tgtKey,
      sourceBoundaryKey: srcBoundary,
      targetBoundaryKey: tgtBoundary,
      threats: edgeThreats,
      highestSeverity: highest,
    });
  }

  // 4. Sort columns by trust-level rank, then label.
  columns.sort((a, b) => {
    const r = TRUST_LEVEL_RANK[a.trustLevel] - TRUST_LEVEL_RANK[b.trustLevel];
    return r !== 0 ? r : a.label.localeCompare(b.label);
  });

  // 5. Nested layer summaries: walk nodes that have _childLayerId.
  const nodeById = new Map<string, Node>(layer.nodes.map((n) => [n.id, n]));
  const nestedLayers: NestedLayerSummary[] = [];
  for (const child of Object.values(layers)) {
    if (child.parentLayerId !== layerId) continue;
    const parentNode = child.parentNodeId ? nodeById.get(child.parentNodeId) : undefined;
    const parentLabel =
      (parentNode?.data as NodeData | undefined)?.label ?? child.name;
    const stats = collectSubtreeThreatStats(layers, threats, child.id);
    nestedLayers.push({
      layerId: child.id,
      layerName: child.name,
      parentNodeLabel: parentLabel,
      threatCount: stats.count,
      highestSeverity: stats.highest,
      severityCounts: stats.counts,
    });
  }
  nestedLayers.sort((a, b) => {
    const ra = a.highestSeverity ? SEVERITY_RANK[a.highestSeverity] : -1;
    const rb = b.highestSeverity ? SEVERITY_RANK[b.highestSeverity] : -1;
    if (rb !== ra) return rb - ra;
    return a.layerName.localeCompare(b.layerName);
  });

  return {
    layerId,
    layerName: layer.name,
    columns,
    flows,
    unboundedCards: unbounded,
    cardCount: cardByKey.size,
    nestedLayers,
  };
}
