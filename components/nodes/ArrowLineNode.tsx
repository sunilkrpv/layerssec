'use client';

import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow';
import type { NodeData } from '@/lib/types';

export default function ArrowLineNode({ selected }: NodeProps<NodeData>) {
  const color = selected ? '#475569' : '#64748b';

  return (
    <div className="relative" style={{ minWidth: 80, minHeight: 20, height: '100%', width: '100%' }}>
      <NodeResizer
        minWidth={60}
        minHeight={4}
        isVisible={selected}
        lineClassName="border-slate-400"
        handleClassName="h-2.5 w-2.5 rounded-full bg-slate-400"
      />
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
      <div className="flex h-full w-full items-center">
        <svg
          width="100%"
          height="20"
          style={{ overflow: 'visible', display: 'block' }}
          preserveAspectRatio="none"
        >
          <defs>
            <marker
              id="arrow-head"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L8,3 z" fill={color} />
            </marker>
          </defs>
          <line
            x1="0"
            y1="10"
            x2="100%"
            y2="10"
            stroke={color}
            strokeWidth="2"
            markerEnd="url(#arrow-head)"
          />
        </svg>
      </div>
    </div>
  );
}
