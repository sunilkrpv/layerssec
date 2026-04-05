'use client';

import { type NodeProps, NodeResizer } from 'reactflow';
import type { NodeData } from '@/lib/types';
import EditableLabel from './EditableLabel';

const TRUST_LEVEL_CONFIG = {
  internal: {
    border: '#22c55e',
    fill: 'rgba(34, 197, 94, 0.06)',
    badge: 'bg-green-100 text-green-700 border-green-300',
    label: 'INTERNAL',
  },
  dmz: {
    border: '#f59e0b',
    fill: 'rgba(245, 158, 11, 0.06)',
    badge: 'bg-amber-100 text-amber-700 border-amber-300',
    label: 'DMZ',
  },
  external: {
    border: '#ef4444',
    fill: 'rgba(239, 68, 68, 0.06)',
    badge: 'bg-red-100 text-red-700 border-red-300',
    label: 'EXTERNAL',
  },
  internet: {
    border: '#b91c1c',
    fill: 'rgba(185, 28, 28, 0.06)',
    badge: 'bg-red-200 text-red-800 border-red-400',
    label: 'INTERNET',
  },
  custom: {
    border: '#64748b',
    fill: 'rgba(100, 116, 139, 0.06)',
    badge: 'bg-slate-100 text-slate-600 border-slate-300',
    label: 'CUSTOM',
  },
} as const;

export default function TrustBoundaryNode({ id, data, selected }: NodeProps<NodeData>) {
  const rawLevel = (data.trustLevel ?? 'internal').toLowerCase();
  const level = (rawLevel in TRUST_LEVEL_CONFIG ? rawLevel : 'custom') as keyof typeof TRUST_LEVEL_CONFIG;
  const config = TRUST_LEVEL_CONFIG[level];

  const borderColor = data.borderColor || config.border;
  const fillColor = data.fillColor || config.fill;

  return (
    <div
      className="relative h-full w-full"
      style={{
        border: `2px dashed ${borderColor}`,
        borderRadius: '8px',
        backgroundColor: fillColor,
        overflow: 'visible',
      }}
    >
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={selected}
        lineClassName="border-slate-400"
        handleClassName="h-3 w-3 rounded-full bg-slate-400"
      />

      {/* Top-left: label + trust level badge */}
      <div className="absolute left-3 top-2 flex items-center gap-2">
        <EditableLabel
          nodeId={id}
          label={data.label}
          className="text-xs font-semibold"
          style={{ color: data.textColor || borderColor }}
        />
        <span
          className={`inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${config.badge}`}
        >
          {config.label}
        </span>
      </div>
    </div>
  );
}
