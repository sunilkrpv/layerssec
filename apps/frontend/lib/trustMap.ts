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

export interface TrustMapView {
  columns: TrustMapColumn[];
  flows: TrustMapFlow[];
  unboundedCards: TrustMapCard[]; // shown as trailing "Unassigned" column when non-empty
  /** Total card count across all columns + unbounded */
  cardCount: number;
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
  // child fully inside boundary
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
  };
}

export function buildTrustMapView(layers: LayerMap, threats: ProjectThreat[]): TrustMapView {
  // 1. Collect every TrustBoundary across all layers.
  const boundaries: { node: Node; layerId: string; layerName: string }[] = [];
  for (const layer of Object.values(layers)) {
    for (const n of layer.nodes) {
      if (n.type === 'trustboundary') {
        boundaries.push({ node: n, layerId: layer.id, layerName: layer.name });
      }
    }
  }

  // 2. For each non-boundary node, decide which boundary owns it.
  //    Parent rule wins; otherwise smallest-area geometric containment.
  const cardByKey = new Map<string, TrustMapCard>();
  const boundaryKeyByCard = new Map<string, string>();
  const columns: TrustMapColumn[] = boundaries.map(({ node, layerId, layerName }) => ({
    boundaryId: node.id,
    boundaryKey: makeCardKey(layerId, node.id),
    layerId,
    layerName,
    label: (node.data as NodeData | undefined)?.label ?? 'Trust Boundary',
    trustLevel: normalizeTrustLevel(node.data as NodeData | undefined),
    cards: [],
  }));

  const columnByBoundaryKey = new Map<string, TrustMapColumn>();
  for (const col of columns) columnByBoundaryKey.set(col.boundaryKey, col);

  const unbounded: TrustMapCard[] = [];

  const boundariesByLayer = new Map<string, typeof boundaries>();
  for (const b of boundaries) {
    const list = boundariesByLayer.get(b.layerId) ?? [];
    list.push(b);
    boundariesByLayer.set(b.layerId, list);
  }

  for (const layer of Object.values(layers)) {
    const layerBoundaries = boundariesByLayer.get(layer.id) ?? [];

    for (const n of layer.nodes) {
      if (n.type === 'trustboundary') continue;

      // Parent rule
      if (n.parentNode) {
        const parentMatch = layerBoundaries.find((b) => b.node.id === n.parentNode);
        if (parentMatch) {
          const card = buildCard(n, layer.id, layer.name, 'parent');
          cardByKey.set(card.key, card);
          const bk = makeCardKey(parentMatch.layerId, parentMatch.node.id);
          boundaryKeyByCard.set(card.key, bk);
          const col = columnByBoundaryKey.get(bk);
          if (!col) { unbounded.push(card); continue; }
          col.cards.push(card);
          continue;
        }
      }

      // Geometric rule: smallest-area containing boundary wins
      const containing = layerBoundaries
        .filter((b) => rectContains(b.node, n))
        .sort((a, b) => nodeArea(a.node) - nodeArea(b.node));
      if (containing.length > 0) {
        const winner = containing[0];
        const card = buildCard(n, layer.id, layer.name, 'geometric');
        cardByKey.set(card.key, card);
        const bk = makeCardKey(winner.layerId, winner.node.id);
        boundaryKeyByCard.set(card.key, bk);
        const col = columnByBoundaryKey.get(bk);
        if (!col) { unbounded.push(card); continue; }
        col.cards.push(card);
        continue;
      }

      // Unassigned
      const orphan = buildCard(n, layer.id, layer.name, 'geometric');
      cardByKey.set(orphan.key, orphan);
      unbounded.push(orphan);
    }
  }

  // 3. Walk edges, emit flows for cross-boundary edges, attach threats.
  const threatsByTarget = new Map<string, ProjectThreat[]>();
  for (const t of threats) {
    const list = threatsByTarget.get(t.targetId) ?? [];
    list.push(t);
    threatsByTarget.set(t.targetId, list);
  }

  const flows: TrustMapFlow[] = [];
  for (const layer of Object.values(layers)) {
    for (const edge of layer.edges) {
      const srcKey = makeCardKey(layer.id, edge.source);
      const tgtKey = makeCardKey(layer.id, edge.target);
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
        layerId: layer.id,
        sourceCardKey: srcKey,
        targetCardKey: tgtKey,
        sourceBoundaryKey: srcBoundary,
        targetBoundaryKey: tgtBoundary,
        threats: edgeThreats,
        highestSeverity: highest,
      });
    }
  }

  // 4. Sort columns by trust-level rank, then by label.
  columns.sort((a, b) => {
    const r = TRUST_LEVEL_RANK[a.trustLevel] - TRUST_LEVEL_RANK[b.trustLevel];
    return r !== 0 ? r : a.label.localeCompare(b.label);
  });

  return {
    columns,
    flows,
    unboundedCards: unbounded,
    cardCount: cardByKey.size,
  };
}
