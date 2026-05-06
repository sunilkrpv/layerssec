'use client';

import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow';
import type { NodeData } from '@/lib/types';
import ChildLayerBadge from './ChildLayerBadge';
import EditableLabel from './EditableLabel';
import RotateHandle from './RotateHandle';

export default function TriangleNode({ id, data, selected }: NodeProps<NodeData>) {
  const stroke = data.borderColor ?? (selected ? '#475569' : '#94a3b8');
  const fill = data.fillColor || 'white';

  return (
    <div
      className="relative flex min-h-[80px] min-w-[80px] flex-col items-center bg-transparent"
      style={{ transform: `rotate(${data.rotation ?? 0}deg)`, transformOrigin: 'center', overflow: 'visible' }}
    >
      <NodeResizer
        minWidth={60}
        minHeight={60}
        isVisible={selected}
        lineClassName="border-slate-400"
        handleClassName="h-2.5 w-2.5 rounded-full bg-slate-400"
      />
      <RotateHandle visible={selected} rotation={data.rotation ?? 0} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />

      <svg
        viewBox="0 0 100 90"
        width="100%"
        height="100%"
        style={{ display: 'block' }}
        preserveAspectRatio="none"
      >
        <polygon
          points="50,4 96,86 4,86"
          fill={fill}
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>

      <EditableLabel
        nodeId={id}
        label={data.label}
        className="absolute text-center text-sm font-medium text-slate-700"
          style={{ color: data.textColor || undefined }}
        />
      {data._childLayerId && <ChildLayerBadge childLayerId={data._childLayerId} />}
    </div>
  );
}
