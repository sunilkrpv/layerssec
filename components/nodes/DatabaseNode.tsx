'use client';

import { Handle, Position, type NodeProps } from 'reactflow';
import { Database } from 'lucide-react';
import type { NodeData } from '@/lib/types';

export default function DatabaseNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className={`relative min-w-[140px] rounded-xl border-2 bg-white shadow-sm transition-all ${
        selected
          ? 'border-green-500 shadow-md shadow-green-200'
          : 'border-green-300 hover:border-green-400 hover:shadow-md'
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <div className="flex flex-col items-center gap-1 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50">
          <Database size={20} className="text-green-600" />
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
