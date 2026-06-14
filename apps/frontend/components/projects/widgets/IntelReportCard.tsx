'use client';

import { useEffect, useState } from 'react';
import { Brain, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import {
  apiListIntelReports,
  apiGetIntelReport,
  apiCreateIntelReport,
  type IntelReport,
  type IntelReportListItem,
} from '@/lib/api';
import { cn } from '@/lib/utils';

interface Props {
  projectId: string;
}

export function IntelReportCard({ projectId }: Props) {
  const [latest, setLatest] = useState<IntelReport | null>(null);
  const [history, setHistory] = useState<IntelReportListItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiListIntelReports(projectId)
      .then(async (items) => {
        setHistory(items);
        if (items.length > 0) {
          const report = await apiGetIntelReport(items[0].id);
          setLatest(report);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load intel'))
      .finally(() => setLoading(false));
  }, [projectId]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const report = await apiCreateIntelReport(projectId);
      setLatest(report);
      setHistory((prev) => [{ id: report.id, generatedAt: report.generatedAt, generatedBy: report.generatedBy }, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSelectHistory(item: IntelReportListItem) {
    try {
      const report = await apiGetIntelReport(item.id);
      setLatest(report);
      setHistoryOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-violet-500" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Threat Intel</h3>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors',
            generating && 'opacity-60 cursor-not-allowed',
          )}
        >
          {generating ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Generating…
            </>
          ) : (
            'Generate'
          )}
        </button>
      </div>

      {loading && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!loading && latest && (
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            {formatDate(latest.generatedAt)}
          </p>
          <p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300 line-clamp-5">
            {latest.content.slice(0, 300)}{latest.content.length > 300 ? '…' : ''}
          </p>
        </div>
      )}

      {!loading && !latest && !generating && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No intel reports yet. Click Generate to create one.
        </p>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="mt-1 border-t border-slate-100 dark:border-slate-800 pt-2">
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            {historyOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            History ({history.length})
          </button>

          {historyOpen && (
            <ul className="mt-2 space-y-1">
              {history.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectHistory(item)}
                    className={cn(
                      'w-full text-left text-xs px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors',
                      latest?.id === item.id
                        ? 'text-violet-600 dark:text-violet-400 font-medium'
                        : 'text-slate-600 dark:text-slate-400',
                    )}
                  >
                    {formatDate(item.generatedAt)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
