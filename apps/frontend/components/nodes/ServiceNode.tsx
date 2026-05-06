'use client';

import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow';
import { Server } from 'lucide-react';
import type { NodeData } from '@/lib/types';
import ChildLayerBadge from './ChildLayerBadge';
import EditableLabel from './EditableLabel';
import RotateHandle from './RotateHandle';

export default function ServiceNode({ id, data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className={`relative min-w-[140px] rounded-xl border-2 bg-blue-50 shadow-sm transition-all ${
        selected
          ? 'border-blue-500 shadow-md shadow-blue-200'
          : 'border-blue-300 hover:border-blue-400 hover:shadow-md'
      }`}
          style={{ borderColor: data.borderColor || undefined, backgroundColor: data.fillColor || undefined, transform: `rotate(${data.rotation ?? 0}deg)`, transformOrigin: 'center', overflow: 'visible' }}
    >
      <NodeResizer minWidth={120} minHeight={80} isVisible={selected} lineClassName="border-blue-400" handleClassName="h-2.5 w-2.5 rounded-full bg-blue-400" />
      <RotateHandle visible={selected} rotation={data.rotation ?? 0} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <div className="flex flex-col items-center gap-1 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
          <Server size={20} className="text-blue-600" />
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
