import type { Node, Edge } from 'reactflow';
import type { DiagramNode, DiagramEdge, NodeData } from './types';

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
    labelStyle: { fontSize: 11, fill: '#475569' },
    labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.8 },
  }));
}

export function generateId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
