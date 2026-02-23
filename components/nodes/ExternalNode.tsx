'use client';

import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow';
import { ExternalLink } from 'lucide-react';
import type { NodeData } from '@/lib/types';
import ChildLayerBadge from './ChildLayerBadge';
import EditableLabel from './EditableLabel';

export default function ExternalNode({ id, data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className={`relative min-w-[140px] rounded-xl border-2 bg-white shadow-sm transition-all ${
        selected
          ? 'border-slate-500 shadow-md shadow-slate-200'
          : 'border-slate-300 hover:border-slate-400 hover:shadow-md'
      }`}
    >
      <NodeResizer minWidth={120} minHeight={80} isVisible={selected} lineClassName="border-slate-400" handleClassName="h-2.5 w-2.5 rounded-full bg-slate-400" />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <div className="flex flex-col items-center gap-1 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
          <ExternalLink size={20} className="text-slate-600" />
        </div>
        <EditableLabel nodeId={id} label={data.label} className="text-center text-sm font-semibold leading-tight text-slate-800" />
        {data.technology && (
          <span className="text-xs text-slate-500">{data.technology}</span>
        )}
      </div>
      {data._childLayerId && <ChildLayerBadge childLayerId={data._childLayerId} />}
    </div>
  );
}
