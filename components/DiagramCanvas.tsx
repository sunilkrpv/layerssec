'use client';

import { useCallback, useEffect, useRef, useState, type DragEvent, type MutableRefObject } from 'react';
import ReactFlow, {
  type Node,
  type Edge,
  type Connection,
  type ReactFlowInstance,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useViewport,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  SelectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';

import type { NodeData, NodeType, GenerateResponse } from '@/lib/types';
import { generateId, toReactFlowNodes, toReactFlowEdges, EDGE_MARKER } from '@/lib/diagramUtils';
import { LINE_NODE_TYPES } from '@/lib/nodeConfig';

import ServiceNode from './nodes/ServiceNode';
import DatabaseNode from './nodes/DatabaseNode';
import ClientNode from './nodes/ClientNode';
import GatewayNode from './nodes/GatewayNode';
import LoadBalancerNode from './nodes/LoadBalancerNode';
import QueueNode from './nodes/QueueNode';
import CacheNode from './nodes/CacheNode';
import GroupNode from './nodes/GroupNode';
import StorageNode from './nodes/StorageNode';
import ServerlessNode from './nodes/ServerlessNode';
import CdnNode from './nodes/CdnNode';
import ExternalNode from './nodes/ExternalNode';
import RectangleNode from './nodes/RectangleNode';
import CircleNode from './nodes/CircleNode';
import EllipseNode from './nodes/EllipseNode';
import LineNode from './nodes/LineNode';
import ArrowLineNode from './nodes/ArrowLineNode';
import DottedLineNode from './nodes/DottedLineNode';
import ActorNode from './nodes/ActorNode';
import CylinderNode from './nodes/CylinderNode';
import TriangleNode from './nodes/TriangleNode';
import SystemContextNode from './nodes/SystemContextNode';
import ContainerNode from './nodes/ContainerNode';
import ComponentNode from './nodes/ComponentNode';
import CodeNode from './nodes/CodeNode';
import TextNode from './nodes/TextNode';
import TrustBoundaryNode from './nodes/TrustBoundaryNode';

// ── Helper: recompute a line node's position/width to maintain endpoint attachments ──────────────
function computeUpdatedLinePosition(
  line: Node<NodeData>,
  movedNodeId: string,
  movedPos: { x: number; y: number },
  movedSize: { w: number; h: number },
  allNodes: Node<NodeData>[],
): Node<NodeData> {
  const sourceId = line.data.attachedSource;
  const targetId = line.data.attachedTarget;
  if (sourceId !== movedNodeId && targetId !== movedNodeId) return line;

  const lineH = line.height ?? 20;
  const lineW = line.width ?? 150;

  const getInfo = (id: string) => {
    if (id === movedNodeId) return { x: movedPos.x, y: movedPos.y, w: movedSize.w, h: movedSize.h };
    const n = allNodes.find((nn) => nn.id === id);
    return n ? { x: n.position.x, y: n.position.y, w: n.width ?? 150, h: n.height ?? 80 } : null;
  };

  const src = sourceId ? getInfo(sourceId) : null;
  const tgt = targetId ? getInfo(targetId) : null;

  let x = line.position.x;
  let y = line.position.y;
  let width = lineW;
  const rightEnd = x + width;

  if (src) {
    x = src.x + src.w;
    y = src.y + src.h / 2 - lineH / 2;
    if (!tgt) width = Math.max(20, rightEnd - x);
  }
  if (tgt) {
    const tgtLeft = tgt.x;
    width = Math.max(20, tgtLeft - x);
    const tgtCY = tgt.y + tgt.h / 2;
    y = src ? (src.y + src.h / 2 + tgtCY) / 2 - lineH / 2 : tgtCY - lineH / 2;
  }

  return { ...line, position: { x, y }, style: { ...line.style, width, height: lineH } };
}

// Defined outside component to prevent React Flow re-mounting nodes on every render
const NODE_TYPES = {
  service: ServiceNode,
  database: DatabaseNode,
  client: ClientNode,
  gateway: GatewayNode,
  loadbalancer: LoadBalancerNode,
  queue: QueueNode,
  cache: CacheNode,
  group: GroupNode,
  storage: StorageNode,
  serverless: ServerlessNode,
  cdn: CdnNode,
  external: ExternalNode,
  rectangle: RectangleNode,
  circle: CircleNode,
  ellipse: EllipseNode,
  line: LineNode,
  arrowline: ArrowLineNode,
  dottedline: DottedLineNode,
  actor: ActorNode,
  cylinder: CylinderNode,
  triangle: TriangleNode,
  systemcontext: SystemContextNode,
  container: ContainerNode,
  component: ComponentNode,
  code: CodeNode,
  text: TextNode,
  trustboundary: TrustBoundaryNode,
};

export type ExtendedRFInstance = ReactFlowInstance & {
  loadDiagram: (diagram: GenerateResponse) => void;
  clearDiagram: () => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  deleteNode: (nodeId: string) => void;
  addNodeAtCenter: (nodeType: NodeType) => void;
  bringToFront: (nodeId: string) => void;
  sendToBack: (nodeId: string) => void;
  groupNodes: (nodeIds: string[]) => void;
  ungroupNode: (groupId: string) => void;
  updateEdge: (edgeId: string, updates: Partial<Edge>) => void;
  deleteEdge: (edgeId: string) => void;
  pushHistoryNow: () => void;
  doCopy: () => void;
  doPaste: () => void;
};

interface DiagramCanvasProps {
  onNodeSelect: (node: Node<NodeData> | null) => void;
  onEdgeSelect: (edge: Edge | null) => void;
  rfInstanceRef: MutableRefObject<ExtendedRFInstance | null>;
  canvasRef: MutableRefObject<HTMLDivElement | null>;
  /** Clipboard ref lifted to parent so clipboard persists across layer switches */
  clipboardRef: MutableRefObject<{ nodes: Node<NodeData>[]; edges: Edge[] }>;
  /** Nodes pre-loaded from the current layer */
  initialNodes: Node<NodeData>[];
  /** Edges pre-loaded from the current layer */
  initialEdges: Edge[];
  /** Called (debounced) whenever nodes or edges change so the parent can persist them */
  onLayerSave: (nodes: Node<NodeData>[], edges: Edge[]) => void;
  /** Called on right-click so the parent can show a context menu */
  onNodeContextMenu: (event: React.MouseEvent, node: Node<NodeData>) => void;
  /** Called when a node should enter label-edit mode (click-to-add or keypress-to-edit) */
  onRequestEdit?: (nodeId: string, initialChar?: string) => void;
  /** Whether edge/line animations are enabled */
  animateEdges?: boolean;
  /** When true, canvas is view-only: nodes cannot be moved, connected, or edited */
  readOnly?: boolean;
}

export default function DiagramCanvas({
  onNodeSelect,
  onEdgeSelect,
  rfInstanceRef,
  canvasRef,
  clipboardRef,
  initialNodes,
  initialEdges,
  onLayerSave,
  onNodeContextMenu,
  onRequestEdit,
  animateEdges = false,
  readOnly = false,
}: DiagramCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow();
  const { x: vpX, y: vpY, zoom } = useViewport();

  // ── Animate edges ref (stable for use inside memoised callbacks) ──────────
  const animateEdgesRef = useRef(animateEdges);
  useEffect(() => { animateEdgesRef.current = animateEdges; }, [animateEdges]);

  // When animation toggle changes, update all existing edges
  useEffect(() => {
    setEdges((eds) => eds.map((e) => ({ ...e, animated: animateEdges })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateEdges]);

  // ── Alignment guides state ────────────────────────────────────────────────
  const [guideLines, setGuideLines] = useState<{ type: 'v' | 'h'; pos: number }[]>([]);

  // ── Snap-to-shape target highlight for line nodes ─────────────────────────
  const [snapTargetInfo, setSnapTargetInfo] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  // ── Undo / Redo stacks (refs avoid re-renders) ────────────────────────────
  const undoStack = useRef<{ nodes: Node<NodeData>[]; edges: Edge[] }[]>([]);
  const redoStack = useRef<{ nodes: Node<NodeData>[]; edges: Edge[] }[]>([]);

  const pushHistory = useCallback(() => {
    undoStack.current = [
      ...undoStack.current,
      { nodes: getNodes() as Node<NodeData>[], edges: getEdges() },
    ].slice(-50);
    redoStack.current = [];
  }, [getNodes, getEdges]);

  const pushHistoryRef = useRef(pushHistory);
  useEffect(() => {
    pushHistoryRef.current = pushHistory;
  }, [pushHistory]);

  // Stable ref for onLayerSave to avoid stale closures in the debounced effect
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLayerSaveRef = useRef(onLayerSave);
  useEffect(() => {
    onLayerSaveRef.current = onLayerSave;
  }, [onLayerSave]);

  // Stable ref for onRequestEdit
  const onRequestEditRef = useRef(onRequestEdit);
  useEffect(() => {
    onRequestEditRef.current = onRequestEdit;
  }, [onRequestEdit]);

  // Stable ref for onEdgeSelect
  const onEdgeSelectRef = useRef(onEdgeSelect);
  useEffect(() => {
    onEdgeSelectRef.current = onEdgeSelect;
  }, [onEdgeSelect]);

  // Track currently selected nodes for keypress-to-edit
  const selectedNodesRef = useRef<Node<NodeData>[]>([]);

  // Debounced save to parent on every nodes/edges change
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onLayerSaveRef.current(nodes, edges);
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [nodes, edges]);

  // ── Keyboard: Undo / Redo / Copy / Paste / Type-to-edit ──────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      // Undo / Redo (Cmd+Z / Cmd+Shift+Z) — all used values are stable refs
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !isTyping) {
        e.preventDefault();
        if (e.shiftKey) {
          // Redo
          if (redoStack.current.length === 0) return;
          const cur = { nodes: getNodes() as Node<NodeData>[], edges: getEdges() };
          undoStack.current = [...undoStack.current, cur].slice(-50);
          const next = redoStack.current.pop()!;
          setNodes(next.nodes);
          setEdges(next.edges);
        } else {
          // Undo
          if (undoStack.current.length === 0) return;
          const cur = { nodes: getNodes() as Node<NodeData>[], edges: getEdges() };
          redoStack.current = [...redoStack.current, cur].slice(-50);
          const prev = undoStack.current.pop()!;
          setNodes(prev.nodes);
          setEdges(prev.edges);
        }
        return;
      }

      // Select All (Cmd+A / Ctrl+A)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !isTyping) {
        e.preventDefault();
        setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
        return;
      }

      // Copy/Paste
      if ((e.ctrlKey || e.metaKey) && !isTyping) {
        if (e.key === 'c') {
          const selected = getNodes().filter((n) => n.selected);
          if (selected.length === 0) return;
          const selectedIds = new Set(selected.map((n) => n.id));
          const relatedEdges = getEdges().filter(
            (edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target),
          );
          clipboardRef.current = { nodes: selected, edges: relatedEdges };
          return;
        }
        if (e.key === 'v') {
          const { nodes: clipNodes, edges: clipEdges } = clipboardRef.current;
          if (clipNodes.length === 0) return;
          // Push history before paste
          pushHistoryRef.current();
          const OFFSET = 30;
          const idMap = new Map<string, string>();
          const newNodes: Node<NodeData>[] = clipNodes.map((n) => {
            const newId = generateId();
            idMap.set(n.id, newId);
            return {
              ...n,
              id: newId,
              position: { x: n.position.x + OFFSET, y: n.position.y + OFFSET },
              selected: true,
            };
          });
          const newEdges: Edge[] = clipEdges.map((edge) => ({
            ...edge,
            id: generateId(),
            source: idMap.get(edge.source) ?? edge.source,
            target: idMap.get(edge.target) ?? edge.target,
          }));
          setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...newNodes]);
          setEdges((eds) => [...eds, ...newEdges]);
          return;
        }
      }

      // Type-to-edit: printable key pressed while exactly one node is selected
      if (
        !isTyping &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.key.length === 1 &&
        e.key !== ' ' // Space toggles selection in RF, skip
      ) {
        const selected = selectedNodesRef.current;
        if (selected.length === 1) {
          e.preventDefault();
          onRequestEditRef.current?.(selected[0].id, e.key);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      pushHistoryRef.current();
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            animated: animateEdgesRef.current,
            style: { strokeWidth: 2, stroke: '#64748b' },
            markerEnd: EDGE_MARKER,
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData('application/reactflow') as NodeType;
      if (!nodeType) return;

      pushHistoryRef.current();
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const newNode: Node<NodeData> = {
        id: generateId(),
        type: nodeType,
        position,
        data: {
          label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
          description: '',
          technology: '',
        },
        ...(nodeType === 'trustboundary' && { style: { width: 400, height: 300 }, zIndex: -1 }),
      };
      setNodes((nds) => nds.concat(newNode));
      // Auto-enter edit mode for the dropped node
      onRequestEditRef.current?.(newNode.id);
    },
    [screenToFlowPosition, setNodes],
  );

  // ── Alignment guides + snap preview: computed during drag ────────────────
  const onNodeDrag = useCallback(
    (_: React.MouseEvent, node: Node<NodeData>) => {
      const nodeW = node.width ?? 150;
      const nodeH = node.height ?? 80;

      // Alignment guides (all nodes)
      const THRESHOLD = 5;
      const checkX = [node.position.x, node.position.x + nodeW / 2, node.position.x + nodeW];
      const checkY = [node.position.y, node.position.y + nodeH / 2, node.position.y + nodeH];
      const guides: { type: 'v' | 'h'; pos: number }[] = [];
      const seen = new Set<string>();

      for (const n of getNodes().filter((n) => n.id !== node.id && !n.selected)) {
        const nW = n.width ?? 150;
        const nH = n.height ?? 80;
        const txs = [n.position.x, n.position.x + nW / 2, n.position.x + nW];
        const tys = [n.position.y, n.position.y + nH / 2, n.position.y + nH];

        for (const cx of checkX) {
          for (const tx of txs) {
            if (Math.abs(cx - tx) < THRESHOLD) {
              const k = `v${tx}`;
              if (!seen.has(k)) { seen.add(k); guides.push({ type: 'v', pos: tx }); }
            }
          }
        }
        for (const cy of checkY) {
          for (const ty of tys) {
            if (Math.abs(cy - ty) < THRESHOLD) {
              const k = `h${ty}`;
              if (!seen.has(k)) { seen.add(k); guides.push({ type: 'h', pos: ty }); }
            }
          }
        }
      }
      setGuideLines(guides);

      // When a non-line node is dragged, live-update any line nodes attached to it
      if (!LINE_NODE_TYPES.has(node.type ?? '')) {
        const all = getNodes() as Node<NodeData>[];
        const hasAttached = all.some(
          (n) =>
            LINE_NODE_TYPES.has(n.type ?? '') &&
            (n.data.attachedSource === node.id || n.data.attachedTarget === node.id),
        );
        if (hasAttached) {
          setNodes((nds) =>
            (nds as Node<NodeData>[]).map((n) =>
              computeUpdatedLinePosition(
                n,
                node.id,
                node.position,
                { w: node.width ?? 150, h: node.height ?? 80 },
                nds as Node<NodeData>[],
              ),
            ),
          );
        }
      }

      // Snap-target highlight (line nodes only)
      if (LINE_NODE_TYPES.has(node.type ?? '')) {
        const SNAP_RADIUS = 40;
        const lineH = node.height ?? 20;
        const nodeCenterY = node.position.y + lineH / 2;
        let bestDist = SNAP_RADIUS;
        let targetInfo: { x: number; y: number; w: number; h: number } | null = null;

        for (const n of getNodes().filter(
          (n) => n.id !== node.id && !LINE_NODE_TYPES.has(n.type ?? ''),
        )) {
          const nW = n.width ?? 150;
          const nH = n.height ?? 80;
          const nCenterY = n.position.y + nH / 2;
          if (Math.abs(nodeCenterY - nCenterY) > nH) continue;

          const d = Math.min(
            Math.abs(node.position.x - (n.position.x + nW)),          // left end → shape right
            Math.abs(node.position.x + nodeW - n.position.x),          // right end → shape left
          );
          if (d < bestDist) {
            bestDist = d;
            targetInfo = { x: n.position.x, y: n.position.y, w: nW, h: nH };
          }
        }
        setSnapTargetInfo(targetInfo);
      } else {
        setSnapTargetInfo(null);
      }
    },
    [getNodes],
  );

  // ── Drag stop: save history + snap line nodes to nearby shapes ────────────
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node<NodeData>) => {
      pushHistoryRef.current(); // capture post-drag state for undo
      setGuideLines([]);
      setSnapTargetInfo(null);

      if (LINE_NODE_TYPES.has(node.type ?? '')) {
        // Line node dropped: check for snap + record attachments
        const SNAP_RADIUS = 40;
        const nodeW = node.width ?? 150;
        const nodeH = node.height ?? 20;
        const nodeCenterY = node.position.y + nodeH / 2;

        let bestDist = SNAP_RADIUS;
        let snapPos: { x: number; y: number } | null = null;
        let newAttachedSource: string | undefined;
        let newAttachedTarget: string | undefined;

        for (const n of getNodes().filter(
          (n) => n.id !== node.id && !LINE_NODE_TYPES.has(n.type ?? ''),
        )) {
          const nW = n.width ?? 150;
          const nH = n.height ?? 80;
          const nCenterY = n.position.y + nH / 2;
          if (Math.abs(nodeCenterY - nCenterY) > nH) continue;
          const snapY = nCenterY - nodeH / 2;

          // Left end → shape's right edge
          const d1 = Math.abs(node.position.x - (n.position.x + nW));
          if (d1 < bestDist) {
            bestDist = d1;
            snapPos = { x: n.position.x + nW, y: snapY };
            newAttachedSource = n.id;
            newAttachedTarget = undefined;
          }

          // Right end → shape's left edge
          const d2 = Math.abs(node.position.x + nodeW - n.position.x);
          if (d2 < bestDist) {
            bestDist = d2;
            snapPos = { x: n.position.x - nodeW, y: snapY };
            newAttachedSource = undefined;
            newAttachedTarget = n.id;
          }
        }

        setNodes((nds) =>
          nds.map((n) => {
            if (n.id !== node.id) return n;
            return {
              ...n,
              position: snapPos ?? n.position,
              data: {
                ...n.data,
                attachedSource: newAttachedSource,
                attachedTarget: newAttachedTarget,
              },
            };
          }),
        );
      } else {
        // Non-line node dropped: final sync of any attached line nodes
        const all = getNodes() as Node<NodeData>[];
        const hasAttached = all.some(
          (n) =>
            LINE_NODE_TYPES.has(n.type ?? '') &&
            (n.data.attachedSource === node.id || n.data.attachedTarget === node.id),
        );
        if (hasAttached) {
          setNodes((nds) =>
            (nds as Node<NodeData>[]).map((n) =>
              computeUpdatedLinePosition(
                n,
                node.id,
                node.position,
                { w: node.width ?? 150, h: node.height ?? 80 },
                nds as Node<NodeData>[],
              ),
            ),
          );
        }
      }
    },
    [getNodes, setNodes],
  );

  const onInit = useCallback(
    (instance: ReactFlowInstance) => {
      // Fit the view to the initial nodes (if any)
      if (initialNodes.length > 0) {
        setTimeout(() => instance.fitView({ padding: 0.15 }), 50);
      }

      const loadDiagram = (diagram: GenerateResponse) => {
        pushHistoryRef.current();
        const newNodes = toReactFlowNodes(diagram.nodes) as Node<NodeData>[];
        const newEdges = toReactFlowEdges(diagram.edges);
        setNodes(newNodes);
        setEdges(newEdges);
        onLayerSaveRef.current(newNodes, newEdges);
      };

      const clearDiagram = () => {
        pushHistoryRef.current();
        setNodes([]);
        setEdges([]);
        onLayerSaveRef.current([], []);
      };

      const updateNodeData = (nodeId: string, data: Partial<NodeData>) => {
        pushHistoryRef.current();
        setNodes((nds) =>
          nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)),
        );
      };

      const deleteNode = (nodeId: string) => {
        pushHistoryRef.current();
        // Also remove child nodes when deleting a group
        setNodes((nds) => nds.filter((n) => n.id !== nodeId && n.parentNode !== nodeId));
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      };

      const addNodeAtCenter = (nodeType: NodeType) => {
        pushHistoryRef.current();
        const bounds = canvasRef.current?.getBoundingClientRect();
        const screenCenter = bounds
          ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
          : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const jitter = () => (Math.random() - 0.5) * 30;
        const position = instance.project(screenCenter);
        position.x += jitter();
        position.y += jitter();
        const newNode: Node<NodeData> = {
          id: generateId(),
          type: nodeType,
          position,
          data: {
            label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
            description: '',
            technology: '',
          },
          ...(nodeType === 'trustboundary' && { style: { width: 400, height: 300 }, zIndex: -1 }),
        };
        setNodes((nds) => nds.concat(newNode));
        onRequestEditRef.current?.(newNode.id);
      };

      const bringToFront = (nodeId: string) => {
        pushHistoryRef.current();
        setNodes((nds) => {
          const max = Math.max(0, ...nds.map((n) => n.zIndex ?? 0));
          return nds.map((n) => (n.id === nodeId ? { ...n, zIndex: max + 1 } : n));
        });
      };

      const sendToBack = (nodeId: string) => {
        pushHistoryRef.current();
        setNodes((nds) => {
          const min = Math.min(0, ...nds.map((n) => n.zIndex ?? 0));
          return nds.map((n) => (n.id === nodeId ? { ...n, zIndex: min - 1 } : n));
        });
      };

      const groupNodes = (nodeIds: string[]) => {
        pushHistoryRef.current();
        setNodes((nds) => {
          const toGroup = nds.filter((n) => nodeIds.includes(n.id) && !n.parentNode);
          if (toGroup.length < 2) return nds;

          const PADDING = 20;
          const DEFAULT_W = 150;
          const DEFAULT_H = 80;

          const minX = Math.min(...toGroup.map((n) => n.position.x));
          const minY = Math.min(...toGroup.map((n) => n.position.y));
          const maxX = Math.max(...toGroup.map((n) => n.position.x + (n.width ?? DEFAULT_W)));
          const maxY = Math.max(...toGroup.map((n) => n.position.y + (n.height ?? DEFAULT_H)));

          const groupId = generateId();
          const groupWidth = maxX - minX + PADDING * 2;
          const groupHeight = maxY - minY + PADDING * 2;

          const groupNode: Node<NodeData> = {
            id: groupId,
            type: 'group',
            position: { x: minX - PADDING, y: minY - PADDING },
            style: { width: groupWidth, height: groupHeight },
            data: { label: 'Group', description: '', technology: '' },
            zIndex: -1,
          };

          const updatedChildren = toGroup.map((n) => ({
            ...n,
            parentNode: groupId,
            extent: 'parent' as const,
            position: {
              x: n.position.x - (minX - PADDING),
              y: n.position.y - (minY - PADDING),
            },
            selected: false,
          }));

          return [
            groupNode,
            ...nds
              .filter((n) => !nodeIds.includes(n.id))
              .map((n) => ({ ...n, selected: false })),
            ...updatedChildren,
          ];
        });
      };

      const ungroupNode = (groupId: string) => {
        pushHistoryRef.current();
        setNodes((nds) => {
          const groupNode = nds.find((n) => n.id === groupId);
          if (!groupNode) return nds;

          const children = nds.filter((n) => n.parentNode === groupId);
          const ungrouped = children.map((n) => ({
            ...n,
            parentNode: undefined,
            extent: undefined,
            position: {
              x: groupNode.position.x + n.position.x,
              y: groupNode.position.y + n.position.y,
            },
          }));

          return [
            ...nds.filter((n) => n.id !== groupId && n.parentNode !== groupId),
            ...ungrouped,
          ];
        });
      };

      const updateEdge = (edgeId: string, updates: Partial<Edge>) => {
        pushHistoryRef.current();
        setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, ...updates } : e)));
      };

      const deleteEdge = (edgeId: string) => {
        pushHistoryRef.current();
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      };

      const pushHistoryNow = () => {
        pushHistoryRef.current();
      };

      const doCopy = () => {
        const selected = getNodes().filter((n) => n.selected);
        if (selected.length === 0) return;
        const selectedIds = new Set(selected.map((n) => n.id));
        const relatedEdges = getEdges().filter(
          (edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target),
        );
        clipboardRef.current = { nodes: selected as Node<NodeData>[], edges: relatedEdges };
      };

      const doPaste = () => {
        const { nodes: clipNodes, edges: clipEdges } = clipboardRef.current;
        if (clipNodes.length === 0) return;
        pushHistoryRef.current();
        const OFFSET = 30;
        const idMap = new Map<string, string>();
        const newNodes: Node<NodeData>[] = clipNodes.map((n) => {
          const newId = generateId();
          idMap.set(n.id, newId);
          return {
            ...n,
            id: newId,
            position: { x: n.position.x + OFFSET, y: n.position.y + OFFSET },
            selected: true,
          };
        });
        const newEdges: Edge[] = clipEdges.map((edge) => ({
          ...edge,
          id: generateId(),
          source: idMap.get(edge.source) ?? edge.source,
          target: idMap.get(edge.target) ?? edge.target,
        }));
        setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...newNodes]);
        setEdges((eds) => [...eds, ...newEdges]);
      };

      rfInstanceRef.current = Object.assign(instance, {
        loadDiagram,
        clearDiagram,
        updateNodeData,
        deleteNode,
        addNodeAtCenter,
        bringToFront,
        sendToBack,
        groupNodes,
        ungroupNode,
        updateEdge,
        deleteEdge,
        pushHistoryNow,
        doCopy,
        doPaste,
      }) as ExtendedRFInstance;
    },
    // initialNodes.length is intentionally included so fitView fires on remount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rfInstanceRef, setNodes, setEdges, initialNodes.length],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<NodeData>) => {
      onNodeSelect(node);
      onEdgeSelectRef.current(null);
    },
    [onNodeSelect],
  );

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    onEdgeSelectRef.current(edge);
  }, []);

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
    onEdgeSelectRef.current(null);
  }, [onNodeSelect]);

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node<NodeData>) => {
      event.preventDefault();
      onNodeContextMenu(event, node);
    },
    [onNodeContextMenu],
  );

  const handleSelectionChange = useCallback(({ nodes: sel }: { nodes: Node[] }) => {
    selectedNodesRef.current = sel as Node<NodeData>[];
  }, []);

  return (
    <div ref={canvasRef} className="relative h-full flex-1" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={handleNodeContextMenu}
        onSelectionChange={handleSelectionChange}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={NODE_TYPES}
        selectionMode={SelectionMode.Partial}
        fitView
        deleteKeyCode={readOnly ? null : 'Backspace'}
        multiSelectionKeyCode="Shift"
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        className="bg-slate-50"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="rounded-xl border border-slate-200 shadow-sm"
        />
      </ReactFlow>

      {/* Snap-target highlight for line nodes */}
      {snapTargetInfo && (
        <div
          className="pointer-events-none absolute rounded-lg border-2 border-blue-400 transition-all duration-75"
          style={{
            left: snapTargetInfo.x * zoom + vpX,
            top: snapTargetInfo.y * zoom + vpY,
            width: snapTargetInfo.w * zoom,
            height: snapTargetInfo.h * zoom,
            zIndex: 9998,
            boxShadow: '0 0 0 4px rgba(59,130,246,0.2), 0 0 16px rgba(59,130,246,0.35)',
          }}
        />
      )}

      {/* Alignment guide lines — rendered in flow coordinates mapped to screen */}
      {guideLines.length > 0 && (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ zIndex: 9999 }}
        >
          {guideLines.map((guide, i) =>
            guide.type === 'v' ? (
              <div
                key={`vg${i}`}
                className="absolute bottom-0 top-0 border-l-2 border-dashed border-red-400 opacity-80"
                style={{ left: guide.pos * zoom + vpX }}
              />
            ) : (
              <div
                key={`hg${i}`}
                className="absolute left-0 right-0 border-t-2 border-dashed border-red-400 opacity-80"
                style={{ top: guide.pos * zoom + vpY }}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
