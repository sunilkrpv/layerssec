'use client';

import { Handle, Position, type NodeProps } from 'reactflow';
import { Zap } from 'lucide-react';
import type { NodeData } from '@/lib/types';

export default function CacheNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className={`relative min-w-[140px] rounded-xl border-2 bg-white shadow-sm transition-all ${
        selected
          ? 'border-cyan-500 shadow-md shadow-cyan-200'
          : 'border-cyan-300 hover:border-cyan-400 hover:shadow-md'
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <div className="flex flex-col items-center gap-1 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50">
          <Zap size={20} className="text-cyan-600" />
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
