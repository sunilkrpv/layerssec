'use client';

import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow';
import type { NodeData } from '@/lib/types';
import ChildLayerBadge from './ChildLayerBadge';

export default function RectangleNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className={`relative h-full w-full min-h-[60px] min-w-[100px] border-2 bg-white transition-all ${
        selected
          ? 'border-slate-600 shadow-md'
          : 'border-slate-400 hover:border-slate-500'
      }`}
    >
      <NodeResizer
        minWidth={80}
        minHeight={40}
        isVisible={selected}
        lineClassName="border-slate-400"
        handleClassName="h-2.5 w-2.5 rounded-full bg-slate-400"
      />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <div className="flex h-full w-full items-center justify-center px-3 py-2">
        <span className="text-center text-sm font-medium text-slate-700">{data.label}</span>
      </div>
      {data._childLayerId && <ChildLayerBadge childLayerId={data._childLayerId} />}
    </div>
  );
}
