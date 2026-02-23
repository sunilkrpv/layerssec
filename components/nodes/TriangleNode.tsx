'use client';

import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow';
import type { NodeData } from '@/lib/types';
import ChildLayerBadge from './ChildLayerBadge';

export default function TriangleNode({ data, selected }: NodeProps<NodeData>) {
  const stroke = selected ? '#475569' : '#94a3b8';

  return (
    <div className="relative flex min-h-[80px] min-w-[80px] flex-col items-center bg-transparent">
      <NodeResizer
        minWidth={60}
        minHeight={60}
        isVisible={selected}
        lineClassName="border-slate-400"
        handleClassName="h-2.5 w-2.5 rounded-full bg-slate-400"
      />
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
          fill="white"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>

      <span
        className="absolute text-center text-sm font-medium text-slate-700"
        style={{ bottom: '20%', width: '100%', padding: '0 8px' }}
      >
        {data.label}
      </span>
      {data._childLayerId && <ChildLayerBadge childLayerId={data._childLayerId} />}
    </div>
  );
}
