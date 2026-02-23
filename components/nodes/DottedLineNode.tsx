'use client';

import { type NodeProps, NodeResizer } from 'reactflow';
import type { NodeData } from '@/lib/types';
import RotateHandle from './RotateHandle';
import LineEndpointHandle from './LineEndpointHandle';

export default function DottedLineNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className="relative"
      style={{
        minWidth: 80,
        minHeight: 20,
        height: '100%',
        width: '100%',
        transform: `rotate(${data.rotation ?? 0}deg)`,
        transformOrigin: 'center',
        overflow: 'visible',
      }}
    >
      <NodeResizer
        minWidth={60}
        minHeight={4}
        isVisible={selected}
        lineClassName="border-slate-400"
        handleClassName="h-2.5 w-2.5 rounded-full bg-slate-400"
      />
      <RotateHandle visible={!!selected} rotation={data.rotation ?? 0} />
      <LineEndpointHandle visible={!!selected} side="left" />
      <div className="flex h-full w-full items-center">
        <div
          className="w-full"
          style={{
            borderTop: `2px dashed ${data.borderColor ?? (selected ? '#475569' : '#94a3b8')}`,
          }}
        />
      </div>
      <LineEndpointHandle visible={!!selected} side="right" />
    </div>
  );
}
