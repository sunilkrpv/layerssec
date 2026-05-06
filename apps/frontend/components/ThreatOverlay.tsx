'use client';

import { useMemo } from 'react';
import { NodeToolbar, Position } from 'reactflow';
import type { ThreatItem, ThreatSeverity } from '@/lib/api';

const SEVERITY_ORDER: ThreatSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const SEVERITY_DOT_CLS: Record<ThreatSeverity, string> = {
  CRITICAL: 'bg-red-500 ring-red-200',
  HIGH: 'bg-orange-500 ring-orange-200',
  MEDIUM: 'bg-yellow-400 ring-yellow-200',
  LOW: 'bg-green-500 ring-green-200',
  INFO: 'bg-slate-400 ring-slate-200',
};

interface NodeThreatData {
  count: number;
  topSeverity: ThreatSeverity;
}

interface ThreatOverlayProps {
  /** Threats filtered to the current layer */
  threats: ThreatItem[];
  /** Called when user clicks a badge — passes the targetId (node ID) */
  onNodeClick: (targetId: string) => void;
  /** The targetId currently highlighted in the Threat Model panel */
  activeTargetId?: string | null;
}

export default function ThreatOverlay({ threats, onNodeClick, activeTargetId }: ThreatOverlayProps) {
  // Group by targetId — compute count + highest severity per node
  const threatMap = useMemo(() => {
    const map = new Map<string, NodeThreatData>();
    for (const t of threats) {
      const existing = map.get(t.targetId);
      if (!existing) {
        map.set(t.targetId, { count: 1, topSeverity: t.severity });
      } else {
        const isHigher = SEVERITY_ORDER.indexOf(t.severity) < SEVERITY_ORDER.indexOf(existing.topSeverity);
        map.set(t.targetId, {
          count: existing.count + 1,
          topSeverity: isHigher ? t.severity : existing.topSeverity,
        });
      }
    }
    return map;
  }, [threats]);

  if (threatMap.size === 0) return null;

  return (
    <>
      {Array.from(threatMap.entries()).map(([nodeId, data]) => {
        const isActive = activeTargetId === nodeId;
        const dotCls = SEVERITY_DOT_CLS[data.topSeverity];

        return (
          <NodeToolbar
            key={nodeId}
            nodeId={nodeId}
            position={Position.Top}
            align="end"
            offset={2}
            isVisible
          >
            <button
              onClick={() => onNodeClick(nodeId)}
              title={`${data.count} threat${data.count !== 1 ? 's' : ''} · ${data.topSeverity}`}
              className={[
                'flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5',
                'text-[10px] font-bold text-white shadow-md ring-2',
                'transition-transform hover:scale-110 focus:outline-none',
                dotCls,
                isActive ? 'scale-125 ring-amber-400' : '',
              ].join(' ')}
            >
              {data.count}
            </button>
          </NodeToolbar>
        );
      })}
    </>
  );
}
