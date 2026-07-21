'use client';

import { useEffect, useState } from 'react';
import { GitBranch, ShieldAlert, BarChart2 } from 'lucide-react';
import {
  apiListProjectThreats,
  apiGetPostureRollup,
  type PostureRollupResult,
} from '@/lib/api';
import { cn } from '@/lib/utils';

interface Props {
  projectId: string;
  flowCount: number;
}

interface ThreatsSummary {
  totalActive: number;
  critical: number;
  high: number;
  mitigated: number;
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-slate-400 dark:text-slate-600';
  if (score >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreGradeBg(score: number | null): string {
  if (score === null) return 'bg-slate-100 dark:bg-slate-800';
  if (score >= 75) return 'bg-emerald-50 dark:bg-emerald-950/40';
  if (score >= 50) return 'bg-amber-50 dark:bg-amber-950/40';
  return 'bg-red-50 dark:bg-red-950/40';
}

export function ProjectStatsCards({ projectId, flowCount }: Props) {
  const [threats, setThreats] = useState<ThreatsSummary | null>(null);
  const [posture, setPosture] = useState<PostureRollupResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiListProjectThreats(projectId, { limit: 1 }).then((r) => r.summary),
      apiGetPostureRollup(projectId),
    ])
      .then(([t, p]) => {
        setThreats(t);
        setPosture(p);
      })
      .catch(() => { /* ignore */ })
      .finally(() => setLoading(false));
  }, [projectId]);

  const postureScore = posture?.projectScore ?? null;
  const threatsActive = threats?.totalActive ?? 0;
  const threatsCritical = threats?.critical ?? 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {/* Flows */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Flows</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <GitBranch size={16} />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{flowCount}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">diagrams</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          {flowCount === 0 ? 'No flows yet' : flowCount === 1 ? '1 architecture flow' : `${flowCount} architecture flows`}
        </p>
      </div>

      {/* Threats */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Threats</span>
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            threatsCritical > 0
              ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
          )}>
            <ShieldAlert size={16} />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className={cn(
            'text-3xl font-bold tabular-nums',
            threatsCritical > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100',
          )}>
            {loading ? '—' : threatsActive}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">active</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          {threatsCritical > 0
            ? `${threatsCritical} critical`
            : threats && threats.high > 0
            ? `${threats.high} high severity`
            : 'No critical threats'}
        </p>
      </div>

      {/* Posture */}
      <div className={cn(
        'rounded-xl border border-slate-200 p-4 shadow-sm dark:border-slate-700',
        scoreGradeBg(postureScore),
      )}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Posture</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/60 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
            <BarChart2 size={16} />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className={cn('text-3xl font-bold tabular-nums', scoreColor(postureScore))}>
            {loading ? '—' : postureScore !== null ? postureScore : '—'}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">/ 100</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          {postureScore === null
            ? 'Not scored yet'
            : postureScore >= 75 ? 'Strong posture'
            : postureScore >= 50 ? 'Needs attention'
            : 'Critical gaps'}
        </p>
      </div>
    </div>
  );
}
