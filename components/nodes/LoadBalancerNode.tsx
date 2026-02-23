'use client';

import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow';
import { Scale } from 'lucide-react';
import type { NodeData } from '@/lib/types';
import ChildLayerBadge from './ChildLayerBadge';
import EditableLabel from './EditableLabel';

export default function LoadBalancerNode({ id, data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className={`relative min-w-[140px] rounded-xl border-2 bg-white shadow-sm transition-all ${
        selected
          ? 'border-red-500 shadow-md shadow-red-200'
          : 'border-red-300 hover:border-red-400 hover:shadow-md'
      }`}
          style={{ borderColor: data.borderColor || undefined, backgroundColor: data.fillColor || undefined }}
    >
      <NodeResizer minWidth={120} minHeight={80} isVisible={selected} lineClassName="border-red-400" handleClassName="h-2.5 w-2.5 rounded-full bg-red-400" />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <div className="flex flex-col items-center gap-1 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
          <Scale size={20} className="text-red-600" />
        </div>
        <EditableLabel nodeId={id} label={data.label} className="text-center text-sm font-semibold leading-tight text-slate-800" style={{ color: data.textColor || undefined }}
/>
        {data.technology && (
          <span className="text-xs text-slate-500">{data.technology}</span>
        )}
      </div>
      {data._childLayerId && <ChildLayerBadge childLayerId={data._childLayerId} />}
    </div>
  );
}
