import { MarkerType, type Node, type Edge } from 'reactflow';
import type { DiagramNode, DiagramEdge, NodeData } from './types';

export const EDGE_MARKER = {
  type: MarkerType.ArrowClosed,
  color: '#64748b',
  width: 18,
  height: 18,
};

/** Same marker shape used for markerStart to create double-headed arrows */
export const EDGE_MARKER_START = {
  type: MarkerType.ArrowClosed,
  color: '#64748b',
  width: 18,
  height: 18,
  orient: 'auto-start-reverse',
};

export function toReactFlowNodes(nodes: DiagramNode[]): Node<NodeData>[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
    style: n.style,
    parentNode: n.parentNode,
    extent: n.extent,
    zIndex: n.type === 'group' ? -1 : 1,
  }));
}

export function toReactFlowEdges(edges: DiagramEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: e.animated ?? false,
    type: e.type ?? 'smoothstep',
    style: e.style ?? { strokeWidth: 2, stroke: '#64748b' },
    markerEnd: EDGE_MARKER,
    labelStyle: { fontSize: 11, fill: '#475569' },
    labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.8 },
  }));
}

export function generateId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Rewrites every node ID in an AI-generated diagram to a unique `generateId()`
 * value, and patches all edge source/target/parentNode references to match.
 *
 * LLMs produce stable, predictable IDs like "postgres-db" that collide across
 * layers, causing the wrong node to be highlighted when attack paths or threat
 * overlays reference IDs from a different layer.
 */
export function remapAiDiagramIds(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const idMap = new Map<string, string>();
  nodes.forEach((n) => idMap.set(n.id, generateId()));

  const remappedNodes = nodes.map((n) => ({
    ...n,
    id: idMap.get(n.id)!,
    parentNode: n.parentNode ? (idMap.get(n.parentNode) ?? n.parentNode) : undefined,
  }));

  const remappedEdges = edges.map((e) => ({
    ...e,
    id: generateId(),
    source: idMap.get(e.source) ?? e.source,
    target: idMap.get(e.target) ?? e.target,
  }));

  return { nodes: remappedNodes, edges: remappedEdges };
}
