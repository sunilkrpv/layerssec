'use client';

import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow';
import type { NodeData } from '@/lib/types';
import ChildLayerBadge from './ChildLayerBadge';
import EditableLabel from './EditableLabel';
import RotateHandle from './RotateHandle';

export default function CircleNode({ id, data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className={`relative h-full w-full min-h-[80px] min-w-[80px] rounded-full border-2 bg-white transition-all ${
        selected
          ? 'border-slate-600 shadow-md'
          : 'border-slate-400 hover:border-slate-500'
      }`}
          style={{ borderColor: data.borderColor || undefined, backgroundColor: data.fillColor || undefined, transform: `rotate(${data.rotation ?? 0}deg)`, transformOrigin: 'center', overflow: 'visible' }}
    >
      <NodeResizer
        minWidth={60}
        minHeight={60}
        isVisible={selected}
        keepAspectRatio
        lineClassName="border-slate-400"
        handleClassName="h-2.5 w-2.5 rounded-full bg-slate-400"
      />
      <RotateHandle visible={selected} rotation={data.rotation ?? 0} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <div className="flex h-full w-full items-center justify-center px-3 py-2">
        <EditableLabel nodeId={id} label={data.label} className="text-center text-sm font-medium text-slate-700" style={{ color: data.textColor || undefined }}
/>
      </div>
      {data._childLayerId && <ChildLayerBadge childLayerId={data._childLayerId} />}
    </div>
  );
}
