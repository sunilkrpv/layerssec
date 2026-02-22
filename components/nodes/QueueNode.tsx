'use client';

import { Handle, Position, type NodeProps } from 'reactflow';
import { MessageSquare } from 'lucide-react';
import type { NodeData } from '@/lib/types';

export default function QueueNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className={`relative min-w-[140px] rounded-xl border-2 bg-white shadow-sm transition-all ${
        selected
          ? 'border-yellow-500 shadow-md shadow-yellow-200'
          : 'border-yellow-300 hover:border-yellow-400 hover:shadow-md'
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <div className="flex flex-col items-center gap-1 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-50">
          <MessageSquare size={20} className="text-yellow-600" />
        </div>
        <span className="text-center text-sm font-semibold leading-tight text-slate-800">
          {data.label}
        </span>
        {data.technology && (
          <span className="text-xs text-slate-500">{data.technology}</span>
        )}
      </div>
    </div>
  );
}
