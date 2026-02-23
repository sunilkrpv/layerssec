'use client';

import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow';
import type { NodeData } from '@/lib/types';

export default function DottedLineNode({ selected }: NodeProps<NodeData>) {
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
        <div
          className="w-full"
          style={{
            borderTop: `2px dashed ${selected ? '#475569' : '#94a3b8'}`,
          }}
        />
      </div>
    </div>
  );
}
