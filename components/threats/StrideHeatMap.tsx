'use client';

import { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { ProjectThreat, StrideCategory, ThreatSeverity } from '@/lib/api';
import {
  STRIDE_OPTIONS, STRIDE_LABEL, SEVERITY_OPTIONS, SEVERITY_COLOR_RGB, SEV_SHORT,
} from '@/lib/threatBadges';

export interface StrideHeatMapProps {
  threats: ProjectThreat[];
  activeStride: StrideCategory | 'ALL';
  activeSeverity: ThreatSeverity | 'ALL';
  onCellClick: (stride: StrideCategory, sev: ThreatSeverity) => void;
}

export function StrideHeatMap({ threats, activeStride, activeSeverity, onCellClick }: StrideHeatMapProps) {
  const matrix = useMemo(() => {
    const counts: Partial<Record<StrideCategory, Partial<Record<ThreatSeverity, number>>>> = {};
    for (const t of threats) {
      if (t.status === 'FALSE_POSITIVE') continue;
      if (!counts[t.strideCategory]) counts[t.strideCategory] = {};
      counts[t.strideCategory]![t.severity] = (counts[t.strideCategory]![t.severity] ?? 0) + 1;
    }
    return counts;
  }, [threats]);

  const maxCount = useMemo(() => {
    let max = 1;
    for (const s of STRIDE_OPTIONS)
      for (const v of SEVERITY_OPTIONS) {
        const c = matrix[s]?.[v] ?? 0;
        if (c > max) max = c;
      }
    return max;
  }, [matrix]);

  const totalShown = useMemo(
    () => threats.filter((t) => t.status !== 'FALSE_POSITIVE').length,
    [threats],
  );

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck size={13} className="text-red-500 flex-shrink-0" />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">STRIDE Risk Matrix</span>
        <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">
          {totalShown} active · click to filter
        </span>
      </div>

      {/* Severity column headers */}
      <div className="mb-1 grid grid-cols-[100px_repeat(5,1fr)] gap-1">
        <div />
        {SEVERITY_OPTIONS.map((sev) => (
          <div key={sev} className={`text-center text-[10px] font-bold uppercase tracking-wide ${
            sev === 'CRITICAL' ? 'text-red-600 dark:text-red-400' :
            sev === 'HIGH'     ? 'text-orange-500 dark:text-orange-400' :
            sev === 'MEDIUM'   ? 'text-yellow-600 dark:text-yellow-400' :
            sev === 'LOW'      ? 'text-green-600 dark:text-green-400' :
                                 'text-slate-500 dark:text-slate-400'
          }`}>
            {SEV_SHORT[sev]}
          </div>
        ))}
      </div>

      {/* STRIDE rows */}
      <div className="flex flex-col gap-1">
        {STRIDE_OPTIONS.map((stride) => (
          <div key={stride} className="grid grid-cols-[100px_repeat(5,1fr)] gap-1 items-center">
            {/* Row label */}
            <div className="truncate pr-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
              {STRIDE_LABEL[stride]}
            </div>
            {/* Cells */}
            {SEVERITY_OPTIONS.map((sev) => {
              const count = matrix[stride]?.[sev] ?? 0;
              const isActive = activeStride === stride && activeSeverity === sev;
              const opacity = count === 0 ? 0 : Math.min(0.12 + (count / maxCount) * 0.78, 0.9);
              const textDark = opacity > 0.45;
              return (
                <button
                  key={sev}
                  disabled={count === 0}
                  onClick={() => onCellClick(stride, sev)}
                  title={count > 0 ? `${count} ${STRIDE_LABEL[stride]} / ${sev}` : undefined}
                  style={count > 0 ? { backgroundColor: `rgba(${SEVERITY_COLOR_RGB[sev]}, ${opacity})` } : undefined}
                  className={`flex h-8 items-center justify-center rounded text-xs font-bold tabular-nums transition-all ${
                    count === 0
                      ? 'cursor-default border border-dashed border-slate-200 text-slate-300 dark:border-slate-700 dark:text-slate-700'
                      : isActive
                        ? 'cursor-pointer shadow ring-2 ring-inset ring-slate-700 dark:ring-slate-200'
                        : 'cursor-pointer hover:ring-2 hover:ring-inset hover:ring-slate-400 hover:shadow'
                  }`}
                >
                  {count > 0
                    ? <span className={textDark ? 'text-white' : 'text-slate-800 dark:text-slate-200'}>{count}</span>
                    : <span>—</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Active filter hint */}
      {(activeStride !== 'ALL' || activeSeverity !== 'ALL') && (
        <p className="mt-3 text-center text-[10px] text-blue-500 dark:text-blue-400">
          Filtering: {activeSeverity !== 'ALL' ? activeSeverity : 'all'} × {activeStride !== 'ALL' ? STRIDE_LABEL[activeStride] : 'all STRIDE'}
          {' · '}
          <button
            onClick={() => { onCellClick(activeStride as StrideCategory, activeSeverity as ThreatSeverity); }}
            className="underline hover:no-underline"
          >
            clear
          </button>
        </p>
      )}
    </div>
  );
}
