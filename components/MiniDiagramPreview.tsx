'use client';

import { useEffect } from 'react';
import ReactFlow, { Background, Controls, ReactFlowProvider, useReactFlow } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { PALETTE_ITEMS } from '@/lib/nodeConfig';

// ─── Mini node renderer ──────────────────────────────────────────────────────

interface MiniNodeData {
  originalType: string;
  label: string;
}

function MiniNode({ data }: { data: MiniNodeData }) {
  const item = PALETTE_ITEMS.find((p) => p.type === data.originalType);
  const Icon = item?.icon;
  return (
    <div className="min-w-[100px] max-w-[180px] rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-slate-600 dark:bg-slate-800">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={12} className={item?.color ?? 'text-slate-400'} />}
        <span className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-100">
          {data.label}
        </span>
      </div>
      {item && (
        <div className="mt-0.5 text-[9px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {item.label}
        </div>
      )}
    </div>
  );
}

const miniNodeTypes = { miniNode: MiniNode };

// ─── Fit view on mount ───────────────────────────────────────────────────────

function FitOnMount() {
  const { fitView } = useReactFlow();
  useEffect(() => {
    fitView({ padding: 0.2, duration: 0 });
  }, [fitView]);
  return null;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface MiniDiagramPreviewProps {
  nodes: unknown[];
  edges: unknown[];
  className?: string;
}

// ─── Inner canvas (needs to be inside ReactFlowProvider) ─────────────────────

function Inner({ nodes, edges }: { nodes: unknown[]; edges: unknown[] }) {
  const rfNodes: Node[] = (nodes as Array<{ id: string; type?: string; position?: { x: number; y: number }; data?: { label?: string } }>).map((n) => ({
    id: n.id,
    type: 'miniNode',
    position: n.position ?? { x: 0, y: 0 },
    data: {
      originalType: n.type ?? 'service',
      label: n.data?.label ?? n.id,
    },
  }));

  const rfEdges: Edge[] = (edges as Array<{ id?: string; source: string; target: string; label?: string; animated?: boolean }>).map((e, i) => ({
    id: e.id ?? `e-${i}`,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: e.animated ?? false,
    type: 'smoothstep',
  }));

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={miniNodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={true}
      zoomOnScroll={true}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} size={0.5} color="#e5e7eb" />
      <Controls showInteractive={false} />
      <FitOnMount />
    </ReactFlow>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function MiniDiagramPreview({ nodes, edges, className = '' }: MiniDiagramPreviewProps) {
  return (
    <div className={`overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${className}`}>
      <ReactFlowProvider>
        <Inner nodes={nodes} edges={edges} />
      </ReactFlowProvider>
    </div>
  );
}
