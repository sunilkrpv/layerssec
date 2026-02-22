'use client';

import { useCallback, type DragEvent, type MutableRefObject } from 'react';
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
import { generateId, toReactFlowNodes, toReactFlowEdges } from '@/lib/diagramUtils';

import ServiceNode from './nodes/ServiceNode';
import DatabaseNode from './nodes/DatabaseNode';
import ClientNode from './nodes/ClientNode';
import GatewayNode from './nodes/GatewayNode';
import LoadBalancerNode from './nodes/LoadBalancerNode';
import QueueNode from './nodes/QueueNode';
import CacheNode from './nodes/CacheNode';
import GroupNode from './nodes/GroupNode';

// Must be defined outside the component to avoid React Flow re-mounting nodes on every render
const NODE_TYPES = {
  service: ServiceNode,
  database: DatabaseNode,
  client: ClientNode,
  gateway: GatewayNode,
  loadbalancer: LoadBalancerNode,
  queue: QueueNode,
  cache: CacheNode,
  group: GroupNode,
};

export type ExtendedRFInstance = ReactFlowInstance & {
  loadDiagram: (diagram: GenerateResponse) => void;
  clearDiagram: () => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
};

interface DiagramCanvasProps {
  onNodeSelect: (node: Node<NodeData> | null) => void;
  rfInstanceRef: MutableRefObject<ExtendedRFInstance | null>;
}

export default function DiagramCanvas({ onNodeSelect, rfInstanceRef }: DiagramCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition } = useReactFlow();

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            animated: false,
            style: { strokeWidth: 2, stroke: '#64748b' },
          },
          eds
        )
      ),
    [setEdges]
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
    },
    [screenToFlowPosition, setNodes]
  );

  const onInit = useCallback(
    (instance: ReactFlowInstance) => {
      const loadDiagram = (diagram: GenerateResponse) => {
        setNodes(toReactFlowNodes(diagram.nodes) as Node<NodeData>[]);
        setEdges(toReactFlowEdges(diagram.edges));
      };
      const clearDiagram = () => {
        setNodes([]);
        setEdges([]);
      };
      const updateNodeData = (nodeId: string, data: Partial<NodeData>) => {
        setNodes((nds) =>
          nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
        );
      };
      rfInstanceRef.current = Object.assign(instance, {
        loadDiagram,
        clearDiagram,
        updateNodeData,
      }) as ExtendedRFInstance;
    },
    [rfInstanceRef, setNodes, setEdges]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<NodeData>) => onNodeSelect(node),
    [onNodeSelect]
  );

  const onPaneClick = useCallback(() => onNodeSelect(null), [onNodeSelect]);

  return (
    <div className="h-full flex-1" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={NODE_TYPES}
        selectionMode={SelectionMode.Partial}
        fitView
        deleteKeyCode="Backspace"
        multiSelectionKeyCode="Shift"
        className="bg-slate-50"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
        <Controls showInteractive={false} />
        <MiniMap nodeStrokeWidth={3} zoomable pannable className="rounded-xl border border-slate-200 shadow-sm" />
      </ReactFlow>
    </div>
  );
}
