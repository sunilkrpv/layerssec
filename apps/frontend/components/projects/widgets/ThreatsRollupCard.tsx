'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { apiListProjectThreats } from '@/lib/api';

interface ThreatsSummary {
  totalActive: number;
  critical: number;
  high: number;
  mitigated: number;
}

interface Props {
  projectId: string;
}

interface StatTileProps {
  label: string;
  value: number;
  valueClass?: string;
}

function StatTile({ label, value, valueClass }: StatTileProps) {
  return (
    <div className="flex flex-col items-center rounded-md bg-slate-50 dark:bg-slate-800 px-3 py-2 min-w-0">
      <span className={`text-lg font-semibold leading-none ${valueClass ?? 'text-slate-900 dark:text-slate-100'}`}>
        {value}
      </span>
      <span className="mt-1 text-xs text-slate-500 dark:text-slate-400 text-center">{label}</span>
    </div>
  );
}

export function ThreatsRollupCard({ projectId }: Props) {
  const [summary, setSummary] = useState<ThreatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiListProjectThreats(projectId, { limit: 1 })
      .then((res) => setSummary(res.summary))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load threats'))
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert size={16} className="text-red-500" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Threats</h3>
      </div>

      {loading && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!loading && !error && summary && (
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Active" value={summary.totalActive} />
          <StatTile
            label="Critical"
            value={summary.critical}
            valueClass={
              summary.critical > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-slate-900 dark:text-slate-100'
            }
          />
          <StatTile
            label="High"
            value={summary.high}
            valueClass={
              summary.high > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-900 dark:text-slate-100'
            }
          />
          <StatTile label="Mitigated" value={summary.mitigated} valueClass="text-emerald-600 dark:text-emerald-400" />
        </div>
      )}

      {!loading && !error && !summary && (
        <p className="text-sm text-slate-500 dark:text-slate-400">No threat data.</p>
      )}
    </div>
  );
}
