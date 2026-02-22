import type { CSSProperties } from 'react';

export type NodeType =
  | 'service'
  | 'database'
  | 'client'
  | 'gateway'
  | 'loadbalancer'
  | 'queue'
  | 'cache'
  | 'group';

export interface NodeData {
  label: string;
  description?: string;
  technology?: string;
}

export interface DiagramNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
  style?: CSSProperties;
  parentNode?: string;
  extent?: 'parent';
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  type?: string;
  style?: CSSProperties;
}

export interface GenerateResponse {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}
