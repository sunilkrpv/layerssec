'use client';

import { type NodeProps, NodeResizer } from 'reactflow';
import { Cloud } from 'lucide-react';
import type { NodeData } from '@/lib/types';

export default function GroupNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className={`relative h-full w-full rounded-2xl border-2 border-dashed transition-all ${
        selected ? 'border-slate-500 bg-slate-100/60' : 'border-slate-300 bg-slate-50/50'
      }`}
    >
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={selected}
        lineClassName="border-slate-400"
        handleClassName="h-3 w-3 rounded-full bg-slate-400"
      />
      <div className="absolute left-3 top-2 flex items-center gap-1.5">
        <Cloud size={14} className="text-slate-500" />
        <span className="text-xs font-semibold text-slate-600">{data.label}</span>
      </div>
    </div>
  );
}
