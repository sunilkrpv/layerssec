import type { CSSProperties } from 'react';

export type NodeType =
  | 'service'
  | 'database'
  | 'client'
  | 'gateway'
  | 'loadbalancer'
  | 'queue'
  | 'cache'
  | 'group'
  | 'storage'
  | 'serverless'
  | 'cdn'
  | 'external'
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'arrowline'
  | 'dottedline'
  | 'actor'
  | 'cylinder'
  | 'triangle'
  | 'systemcontext'
  | 'container'
  | 'component'
  | 'code'
  | 'text'
  | 'trustboundary';

export interface NodeData {
  label: string;
  description?: string;
  technology?: string;
  /** ID of the child layer created by drilling into this node */
  _childLayerId?: string;
  /** CSS color string for the node border, e.g. '#ef4444' */
  borderColor?: string;
  /** CSS color string for the node background fill */
  fillColor?: string;
  /** CSS color string for the node label text */
  textColor?: string;
  /** Rotation angle in degrees (clockwise) */
  rotation?: number;
  /** Node ID whose right edge the line's left end is attached to */
  attachedSource?: string;
  /** Node ID whose left edge the line's right end is attached to */
  attachedTarget?: string;
  // ── Text-node formatting fields ──────────────────────────────────────────
  fontWeight?: 'bold';
  fontStyle?: 'italic';
  /** Space-separated list: e.g. 'underline', 'line-through', 'underline line-through' */
  textDecoration?: string;
  /** Font size in pixels (default 14) */
  fontSize?: number;
  /** Font family group: sans | serif | mono */
  fontFamily?: 'sans' | 'serif' | 'mono';
  /** Trust level for trustboundary nodes */
  trustLevel?: 'internal' | 'dmz' | 'external' | 'internet' | 'custom';
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
