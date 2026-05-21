'use client';

import { useMemo, useEffect, useRef } from 'react';
import { ExternalLink, PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { TrustMapFlow, TrustMapView } from '@/lib/trustMap';
import type { ProjectThreat, ThreatSeverity } from '@/lib/api';
import { severityBadge } from './trustMapColors';

interface Props {
  view: TrustMapView;
  projectId: string;
  hoveredFlowEdgeId: string | null;
  onThreatClick: (flow: TrustMapFlow, threat: ProjectThreat) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

interface PairGroup {
  key: string;
  sourceLabel: string;
  targetLabel: string;
  flows: TrustMapFlow[];
  threats: { flow: TrustMapFlow; threat: ProjectThreat }[];
}

const SEVERITY_RANK: Record<ThreatSeverity, number> = {
  CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0,
};

export default function BoundaryAnalysisPanel({
  view, projectId, hoveredFlowEdgeId, onThreatClick, collapsed, onToggleCollapsed,
}: Props) {
  const groups: PairGroup[] = useMemo(() => {
    const byKey = new Map<string, PairGroup>();
    const colByKey = new Map(view.columns.map((c) => [c.boundaryKey, c]));
    for (const flow of view.flows) {
      const pairKey = `${flow.sourceBoundaryKey} → ${flow.targetBoundaryKey}`;
      let g = byKey.get(pairKey);
      if (!g) {
        const src = colByKey.get(flow.sourceBoundaryKey);
        const tgt = colByKey.get(flow.targetBoundaryKey);
        g = {
          key: pairKey,
          sourceLabel: src?.label ?? '?',
          targetLabel: tgt?.label ?? '?',
          flows: [],
          threats: [],
        };
        byKey.set(pairKey, g);
      }
      g.flows.push(flow);
      for (const t of flow.threats) g.threats.push({ flow, threat: t });
    }
    return Array.from(byKey.values()).sort((a, b) => {
      const ma = Math.max(0, ...a.threats.map((x) => SEVERITY_RANK[x.threat.severity] ?? 0));
      const mb = Math.max(0, ...b.threats.map((x) => SEVERITY_RANK[x.threat.severity] ?? 0));
      return mb - ma;
    });
  }, [view]);

  const totals = useMemo(() => {
    const t = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 } as Record<ThreatSeverity, number>;
    for (const f of view.flows) for (const th of f.threats) t[th.severity]++;
    return t;
  }, [view.flows]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hoveredFlowEdgeId || !containerRef.current) return;
    const el = containerRef.current.querySelector<HTMLElement>(`[data-flow-id="${hoveredFlowEdgeId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [hoveredFlowEdgeId]);

  const allFlowsThreatFree =
    view.flows.length > 0 && view.flows.every((f) => f.threats.length === 0);

  if (collapsed) {
    return (
      <aside className="flex h-full w-9 flex-col items-center border-l border-slate-200 bg-white py-2 dark:border-slate-700 dark:bg-gray-950">
        <button
          onClick={onToggleCollapsed}
          title="Open boundary analysis"
          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <PanelRightOpen size={16} />
        </button>
        <div
          className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          Boundary analysis
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-gray-950">
      <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Boundary analysis
          </div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            STRIDE · {view.flows.length} flows · {view.cardCount} nodes
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as ThreatSeverity[]).map((s) => (
              totals[s] > 0 ? (
                <span key={s} className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${severityBadge(s)}`}>
                  {s.slice(0, 4)} {totals[s]}
                </span>
              ) : null
            ))}
          </div>
        </div>
        <button
          onClick={onToggleCollapsed}
          title="Hide boundary analysis"
          className="flex-shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <PanelRightClose size={14} />
        </button>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {allFlowsThreatFree && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-200">
            Cross-boundary flows detected but no threats saved yet.
            {' '}
            <a href={`/projects/${projectId}`} className="font-semibold underline">Open diagram</a> and run STRIDE analysis from the AI chat.
          </div>
        )}
        {groups.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No cross-boundary flows detected.
          </div>
        ) : groups.map((g) => (
          <div key={g.key} className="rounded border border-slate-200 dark:border-slate-700">
            <div className="border-b border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {g.sourceLabel} → {g.targetLabel}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {g.threats.length === 0 ? (
                <div className="px-2.5 py-2 text-[11px] text-slate-500 dark:text-slate-400">
                  No threats on these flows.
                </div>
              ) : g.threats.map(({ flow, threat }) => (
                <button
                  key={`${flow.edgeId}-${threat.id}`}
                  data-flow-id={flow.edgeId}
                  onClick={() => onThreatClick(flow, threat)}
                  className={`flex w-full flex-col gap-1 px-2.5 py-2 text-left text-[11px] transition hover:bg-slate-50 dark:hover:bg-slate-800
                    ${hoveredFlowEdgeId === flow.edgeId ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    <span className={`rounded border px-1 py-0.5 font-mono text-[9px] font-bold ${severityBadge(threat.severity)}`}>
                      {threat.severity.slice(0, 4)}
                    </span>
                    <span className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[9px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {threat.strideCategory.slice(0, 1)}
                    </span>
                    <span className="truncate font-semibold text-slate-700 dark:text-slate-200">
                      {threat.title}
                    </span>
                  </div>
                  <div className="line-clamp-2 text-slate-500 dark:text-slate-400">
                    {threat.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 px-3 py-2 text-[11px] dark:border-slate-700">
        <a
          href={`/projects/${projectId}/threats`}
          className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
        >
          View all threats <ExternalLink size={10} />
        </a>
      </div>
    </aside>
  );
}
