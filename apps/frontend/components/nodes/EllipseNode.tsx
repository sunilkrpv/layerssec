'use client';

import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow';
import type { NodeData } from '@/lib/types';
import ChildLayerBadge from './ChildLayerBadge';
import EditableLabel from './EditableLabel';
import RotateHandle from './RotateHandle';

export default function EllipseNode({ id, data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className={`relative h-full w-full min-h-[60px] min-w-[100px] border-2 bg-slate-50 transition-all`}
      style={{
        borderRadius: '50%',
        borderColor: data.borderColor ?? (selected ? '#475569' : '#94a3b8'),
        backgroundColor: data.fillColor || undefined,
        boxShadow: selected ? '0 4px 12px rgba(0,0,0,0.15)' : undefined,
      }}
    >
      <NodeResizer
        minWidth={80}
        minHeight={50}
        isVisible={selected}
        lineClassName="border-slate-400"
        handleClassName="h-2.5 w-2.5 rounded-full bg-slate-400"
      />
      <RotateHandle visible={selected} rotation={data.rotation ?? 0} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <div className="flex h-full w-full items-center justify-center px-4 py-2">
        <EditableLabel nodeId={id} label={data.label} className="text-center text-sm font-medium text-slate-700" style={{ color: data.textColor || undefined }}
/>
      </div>
      {data._childLayerId && <ChildLayerBadge childLayerId={data._childLayerId} />}
    </div>
  );
}
