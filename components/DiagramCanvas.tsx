'use client';

import { useCallback, useEffect, useRef, type DragEvent, type MutableRefObject } from 'react';
import ReactFlow, {
  type Node,
  type Edge,
  type Connection,
  type ReactFlowInstance,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  SelectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';

import type { NodeData, NodeType, GenerateResponse } from '@/lib/types';
import { generateId, toReactFlowNodes, toReactFlowEdges, EDGE_MARKER } from '@/lib/diagramUtils';

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
};

export type ExtendedRFInstance = ReactFlowInstance & {
  loadDiagram: (diagram: GenerateResponse) => void;
  clearDiagram: () => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  deleteNode: (nodeId: string) => void;
  addNodeAtCenter: (nodeType: NodeType) => void;
};

interface DiagramCanvasProps {
  onNodeSelect: (node: Node<NodeData> | null) => void;
  rfInstanceRef: MutableRefObject<ExtendedRFInstance | null>;
  canvasRef: MutableRefObject<HTMLDivElement | null>;
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
}

export default function DiagramCanvas({
  onNodeSelect,
  rfInstanceRef,
  canvasRef,
  initialNodes,
  initialEdges,
  onLayerSave,
  onNodeContextMenu,
  onRequestEdit,
}: DiagramCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow();

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

  // Track currently selected nodes for keypress-to-edit
  const selectedNodesRef = useRef<Node<NodeData>[]>([]);

  // Clipboard for copy/paste
  const clipboardRef = useRef<{ nodes: Node<NodeData>[]; edges: Edge[] }>({
    nodes: [],
    edges: [],
  });

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

  // ── Copy / Paste ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

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
    (connection: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            animated: false,
            style: { strokeWidth: 2, stroke: '#64748b' },
            markerEnd: EDGE_MARKER,
          },
          eds,
        ),
      ),
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
      };
      setNodes((nds) => nds.concat(newNode));
      // Auto-enter edit mode for the dropped node
      onRequestEditRef.current?.(newNode.id);
    },
    [screenToFlowPosition, setNodes],
  );

  const onInit = useCallback(
    (instance: ReactFlowInstance) => {
      // Fit the view to the initial nodes (if any)
      if (initialNodes.length > 0) {
        setTimeout(() => instance.fitView({ padding: 0.15 }), 50);
      }

      const loadDiagram = (diagram: GenerateResponse) => {
        const newNodes = toReactFlowNodes(diagram.nodes) as Node<NodeData>[];
        const newEdges = toReactFlowEdges(diagram.edges);
        setNodes(newNodes);
        setEdges(newEdges);
        onLayerSaveRef.current(newNodes, newEdges);
      };

      const clearDiagram = () => {
        setNodes([]);
        setEdges([]);
        onLayerSaveRef.current([], []);
      };

      const updateNodeData = (nodeId: string, data: Partial<NodeData>) => {
        setNodes((nds) =>
          nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)),
        );
      };

      const deleteNode = (nodeId: string) => {
        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      };

      const addNodeAtCenter = (nodeType: NodeType) => {
        const bounds = canvasRef.current?.getBoundingClientRect();
        const screenCenter = bounds
          ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
          : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        // Small random offset so repeated clicks don't stack perfectly
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
        };
        setNodes((nds) => nds.concat(newNode));
        // Auto-enter label edit mode
        onRequestEditRef.current?.(newNode.id);
      };

      rfInstanceRef.current = Object.assign(instance, {
        loadDiagram,
        clearDiagram,
        updateNodeData,
        deleteNode,
        addNodeAtCenter,
      }) as ExtendedRFInstance;
    },
    // initialNodes.length is intentionally included so fitView fires on remount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rfInstanceRef, setNodes, setEdges, initialNodes.length],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<NodeData>) => onNodeSelect(node),
    [onNodeSelect],
  );

  const onPaneClick = useCallback(() => onNodeSelect(null), [onNodeSelect]);

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
    <div ref={canvasRef} className="h-full flex-1" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={handleNodeContextMenu}
        onSelectionChange={handleSelectionChange}
        nodeTypes={NODE_TYPES}
        selectionMode={SelectionMode.Partial}
        fitView
        deleteKeyCode="Backspace"
        multiSelectionKeyCode="Shift"
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
    </div>
  );
}
