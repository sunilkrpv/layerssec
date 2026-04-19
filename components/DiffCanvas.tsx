'use client';

import { useMemo, useEffect } from 'react';
import ReactFlow, { Background, Controls, ReactFlowProvider, useReactFlow, Handle, Position } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import type { NodeDiff, EdgeDiff, DiffStatus } from '@/lib/diffEngine';
import { PALETTE_ITEMS } from '@/lib/nodeConfig';

// ─── Diff node renderer ───────────────────────────────────────────────────────

interface DiffNodeData {
  originalType: string;
  label: string;
  status: DiffStatus;
}

const STATUS_RING: Record<DiffStatus, string> = {
  added: 'border-green-400 bg-green-50 ring-2 ring-green-300 dark:bg-green-900/30 dark:border-green-500 dark:ring-green-700',
  removed: 'border-red-400 bg-red-50 ring-2 ring-red-300 dark:bg-red-900/30 dark:border-red-500 dark:ring-red-700',
  modified: 'border-amber-400 bg-amber-50 ring-2 ring-amber-300 dark:bg-amber-900/30 dark:border-amber-500 dark:ring-amber-700',
  unchanged: 'border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800',
};

const STATUS_BADGE: Record<DiffStatus, string> = {
  added: 'bg-green-500 text-white',
  removed: 'bg-red-500 text-white',
  modified: 'bg-amber-500 text-white',
  unchanged: '',
};

const STATUS_SYMBOL: Record<DiffStatus, string> = {
  added: '+',
  removed: '−',
  modified: '~',
  unchanged: '',
};

function DiffNode({ data }: { data: DiffNodeData }) {
  const item = PALETTE_ITEMS.find((p) => p.type === data.originalType);
  const Icon = item?.icon;

  return (
    <div
      className={`relative min-w-[120px] max-w-[220px] rounded-lg border-2 px-3 py-2 shadow-sm ${STATUS_RING[data.status]}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-slate-300 !bg-slate-200" />
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-slate-300 !bg-slate-200" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-slate-300 !bg-slate-200" />
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-slate-300 !bg-slate-200" />
      {data.status !== 'unchanged' && (
        <span
          className={`absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${STATUS_BADGE[data.status]}`}
        >
          {STATUS_SYMBOL[data.status]}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={13} className={item?.color ?? 'text-slate-500'} />}
        <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{data.label}</span>
      </div>
      {item && <div className="mt-0.5 text-[9px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{item.label}</div>}
    </div>
  );
}

// Module-level types — frozen for stable identity (React Flow error #002)
const diffNodeTypes = Object.freeze({ diffNode: DiffNode });
const diffEdgeTypes = Object.freeze({});

// ─── Inner canvas — handles fitView on node changes ───────────────────────────

function ReactFlowInner({ nodes, edges }: { nodes: Node<DiffNodeData>[]; edges: Edge[] }) {
  const { fitView } = useReactFlow();

  // Re-fit whenever the node set changes (i.e. the active layer changes)
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.25 }), 50);
    return () => clearTimeout(t);
  }, [nodes, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={diffNodeTypes}
      edgeTypes={diffEdgeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      className="bg-slate-50 dark:bg-slate-800"
    >
      <Background color="#94a3b8" gap={20} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

// ─── DiffCanvas ───────────────────────────────────────────────────────────────

interface VersionInfo {
  number: string;
  comment?: string | null;
}

interface DiffCanvasProps {
  nodeDiffs: NodeDiff[];
  edgeDiffs: EdgeDiff[];
  /** 'left' renders the base project nodes; 'right' renders the modified project nodes */
  side: 'left' | 'right';
  title: string;
  filename: string;
  versionInfo?: VersionInfo | null;
}

export default function DiffCanvas({ nodeDiffs, edgeDiffs, side, title, filename, versionInfo }: DiffCanvasProps) {
  const { nodes, edges } = useMemo(() => {
    // Pick the relevant side of each diff entry
    const nodes: Node<DiffNodeData>[] = [];

    for (const d of nodeDiffs) {
      const srcNode = side === 'left' ? d.left : d.right;
      if (!srcNode) continue; // node doesn't exist on this side

      // Unchanged nodes on either side show normally; removed only on left, added only on right
      const status: DiffStatus =
        side === 'left' && d.status === 'added'
          ? 'unchanged' // added nodes don't appear on left
          : side === 'right' && d.status === 'removed'
            ? 'unchanged' // removed nodes don't appear on right
            : d.status;

      nodes.push({
        id: srcNode.id,
        type: 'diffNode',
        position: srcNode.position,
        data: {
          originalType: (srcNode.type as string) ?? 'rectangle',
          label: (srcNode.data as { label?: string })?.label ?? srcNode.id,
          status,
        },
      });
    }

    const edges: Edge[] = edgeDiffs
      .map((d) => (side === 'left' ? d.left : d.right))
      .filter((e): e is Edge => e != null)
      // Strip original handle IDs — DiffNode uses generic handles (Left/Right/Top/Bottom)
      .map(({ sourceHandle: _sh, targetHandle: _th, ...e }) => e);

    return { nodes, edges };
  }, [nodeDiffs, edgeDiffs, side]);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex h-9 items-center gap-2 px-3 text-xs font-medium">
          <span
            className={`rounded px-1.5 py-0.5 font-bold ${
              side === 'left'
                ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
            }`}
          >
            {side === 'left' ? 'BASE' : 'MODIFIED'}
          </span>
          <span className="truncate font-semibold text-slate-700 dark:text-slate-200">{title}</span>
          <span className="ml-auto flex-shrink-0 font-medium text-slate-500 dark:text-slate-400">{filename}</span>
        </div>

        {/* Version comment row */}
        {versionInfo?.comment && (
          <div className="border-t border-slate-100 px-3 py-1 dark:border-slate-800">
            <p className="truncate text-[10px] italic text-slate-500 dark:text-slate-400">
              &ldquo;{versionInfo.comment}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <ReactFlowProvider>
          <ReactFlowInner nodes={nodes} edges={edges} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
