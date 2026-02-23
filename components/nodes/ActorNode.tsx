'use client';

import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow';
import type { NodeData } from '@/lib/types';
import ChildLayerBadge from './ChildLayerBadge';
import EditableLabel from './EditableLabel';

export default function ActorNode({ id, data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className={`relative flex min-h-[100px] min-w-[80px] flex-col items-center justify-center gap-1 rounded-lg border-2 bg-white px-3 py-3 transition-all ${
        selected
          ? 'border-slate-600 shadow-md'
          : 'border-slate-300 hover:border-slate-400'
      }`}
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

      {/* Stick figure */}
      <svg width="40" height="56" viewBox="0 0 40 56" fill="none" className="flex-shrink-0">
        {/* Head */}
        <circle cx="20" cy="10" r="9" stroke="#475569" strokeWidth="2" />
        {/* Body */}
        <line x1="20" y1="19" x2="20" y2="38" stroke="#475569" strokeWidth="2" />
        {/* Arms */}
        <line x1="6" y1="26" x2="34" y2="26" stroke="#475569" strokeWidth="2" />
        {/* Legs */}
        <line x1="20" y1="38" x2="8" y2="54" stroke="#475569" strokeWidth="2" />
        <line x1="20" y1="38" x2="32" y2="54" stroke="#475569" strokeWidth="2" />
      </svg>

      <EditableLabel nodeId={id} label={data.label} className="text-center text-xs font-medium text-slate-700" />
      {data._childLayerId && <ChildLayerBadge childLayerId={data._childLayerId} />}
    </div>
  );
}
