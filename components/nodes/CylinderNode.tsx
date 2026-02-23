'use client';

import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow';
import type { NodeData } from '@/lib/types';
import ChildLayerBadge from './ChildLayerBadge';

export default function CylinderNode({ data, selected }: NodeProps<NodeData>) {
  const stroke = selected ? '#475569' : '#94a3b8';

  return (
    <div
      className="relative flex min-h-[100px] min-w-[80px] flex-col items-center justify-center gap-2 bg-transparent"
    >
      <NodeResizer
        minWidth={60}
        minHeight={80}
        isVisible={selected}
        lineClassName="border-slate-400"
        handleClassName="h-2.5 w-2.5 rounded-full bg-slate-400"
      />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />

      <svg
        viewBox="0 0 80 100"
        width="100%"
        height="100%"
        style={{ display: 'block', overflow: 'visible' }}
        preserveAspectRatio="none"
      >
        {/* Body rect */}
        <rect x="2" y="14" width="76" height="80" fill="white" stroke={stroke} strokeWidth="2" />
        {/* Bottom ellipse (cap) */}
        <ellipse cx="40" cy="94" rx="38" ry="10" fill="white" stroke={stroke} strokeWidth="2" />
        {/* Top ellipse */}
        <ellipse cx="40" cy="14" rx="38" ry="10" fill="#f1f5f9" stroke={stroke} strokeWidth="2" />
      </svg>

      <span
        className="absolute text-center text-sm font-medium text-slate-700"
        style={{ top: '50%', transform: 'translateY(-50%)', width: '100%', padding: '0 8px' }}
      >
        {data.label}
      </span>
      {data._childLayerId && <ChildLayerBadge childLayerId={data._childLayerId} />}
    </div>
  );
}
