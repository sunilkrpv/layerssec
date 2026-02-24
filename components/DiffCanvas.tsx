'use client';

import { useMemo } from 'react';
import ReactFlow, { Background, Controls, ReactFlowProvider } from 'reactflow';
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
  added: 'border-green-400 bg-green-50 ring-2 ring-green-300',
  removed: 'border-red-400 bg-red-50 ring-2 ring-red-300',
  modified: 'border-amber-400 bg-amber-50 ring-2 ring-amber-300',
  unchanged: 'border-slate-200 bg-white',
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
      {data.status !== 'unchanged' && (
        <span
          className={`absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${STATUS_BADGE[data.status]}`}
        >
          {STATUS_SYMBOL[data.status]}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={13} className={item?.color ?? 'text-slate-500'} />}
        <span className="truncate text-xs font-semibold text-slate-800">{data.label}</span>
      </div>
      {item && <div className="mt-0.5 text-[9px] uppercase tracking-wide text-slate-400">{item.label}</div>}
    </div>
  );
}

// Module-level nodeTypes — must be stable to avoid React Flow re-registration warnings
const diffNodeTypes = { diffNode: DiffNode };

// ─── DiffCanvas ───────────────────────────────────────────────────────────────

interface DiffCanvasProps {
  nodeDiffs: NodeDiff[];
  edgeDiffs: EdgeDiff[];
  /** 'left' renders the base project nodes; 'right' renders the modified project nodes */
  side: 'left' | 'right';
  title: string;
  filename: string;
}

export default function DiffCanvas({ nodeDiffs, edgeDiffs, side, title, filename }: DiffCanvasProps) {
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
      .filter((e): e is Edge => e != null);

    return { nodes, edges };
  }, [nodeDiffs, edgeDiffs, side]);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden border-slate-200">
      {/* Header */}
      <div
        className={`flex h-9 flex-shrink-0 items-center gap-2 border-b px-3 text-xs font-medium ${
          side === 'left'
            ? 'border-slate-200 bg-slate-50 text-slate-600'
            : 'border-slate-200 bg-slate-50 text-slate-600'
        }`}
      >
        <span
          className={`rounded px-1.5 py-0.5 font-bold ${
            side === 'left'
              ? 'bg-slate-200 text-slate-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {side === 'left' ? 'BASE' : 'MODIFIED'}
        </span>
        <span className="font-semibold text-slate-700">{title}</span>
        <span className="ml-auto truncate font-normal text-slate-400">{filename}</span>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={diffNodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            className="bg-slate-50"
          >
            <Background color="#e2e8f0" gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}
