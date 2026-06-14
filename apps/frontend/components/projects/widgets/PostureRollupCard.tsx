'use client';

import { useEffect, useState } from 'react';
import { BarChart2 } from 'lucide-react';
import { apiGetPostureRollup, type PostureRollupResult } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Props {
  projectId: string;
  onOpenDiagram?: (diagramId: string) => void;
}

function scoreColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function scoreTextColor(score: number | null): string {
  if (score === null) return 'text-slate-400 dark:text-slate-600';
  if (score >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function PostureRollupCard({ projectId, onOpenDiagram }: Props) {
  const [rollup, setRollup] = useState<PostureRollupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiGetPostureRollup(projectId)
      .then(setRollup)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load posture'))
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 size={16} className="text-blue-500" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Posture</h3>
      </div>

      {loading && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!loading && !error && rollup && (
        <>
          {/* Big project score */}
          <div className="mb-4 text-center">
            <span
              className={cn(
                'text-4xl font-bold',
                scoreTextColor(rollup.projectScore),
              )}
            >
              {rollup.projectScore !== null ? rollup.projectScore : '—'}
            </span>
            <span className="ml-1 text-sm text-slate-500 dark:text-slate-400">/100</span>
          </div>

          {/* Per-diagram bars */}
          {rollup.diagrams.length > 0 ? (
            <ul className="space-y-2">
              {rollup.diagrams.map((d) => (
                <li key={d.diagramId}>
                  <button
                    type="button"
                    onClick={() => onOpenDiagram?.(d.diagramId)}
                    className="w-full text-left group"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-slate-700 dark:text-slate-300 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors max-w-[70%]">
                        {d.name}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 ml-1">
                        v{d.version} · <span className={scoreTextColor(d.score)}>{d.score}</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', scoreColor(d.score))}
                        style={{ width: `${Math.max(0, Math.min(100, d.score))}%` }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">No diagrams scored yet.</p>
          )}
        </>
      )}

      {!loading && !error && !rollup && (
        <p className="text-sm text-slate-500 dark:text-slate-400">No posture data.</p>
      )}
    </div>
  );
}
