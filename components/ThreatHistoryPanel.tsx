'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Trash2, Loader2, ShieldCheck, ChevronDown, ChevronUp, ScanSearch } from 'lucide-react';
import ThreatResultCard from '@/components/ThreatResultCard';
import {
  apiGetThreatModel,
  apiDeleteThreatModel,
  apiListThreatModels,
  type ThreatModelFull,
  type ThreatModelSummary,
  type ThreatItem,
} from '@/lib/api';

interface ThreatHistoryPanelProps {
  projectId: string;
  isDark: boolean;
  onBack: () => void;
  /** Called when user loads a saved model — parent receives full model object. */
  onLoadModel?: (model: ThreatModelFull) => void;
  /** Optional — shown as a CTA when no saved models exist; back to the parent so it can run analysis. */
  onRunNew?: () => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-green-500',
  INFO: 'bg-slate-400',
};

function SeverityDots({ summary }: { summary: Record<string, number> }) {
  return (
    <div className="flex items-center gap-1">
      {Object.entries(summary)
        .filter(([, count]) => count > 0)
        .map(([sev, count]) => (
          <span
            key={sev}
            title={`${count} ${sev}`}
            className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${SEVERITY_COLORS[sev] ?? 'bg-slate-400'}`}
          >
            {count}
          </span>
        ))}
    </div>
  );
}

export default function ThreatHistoryPanel({
  projectId,
  isDark,
  onBack,
  onLoadModel,
  onRunNew,
}: ThreatHistoryPanelProps) {
  const [models, setModels] = useState<ThreatModelSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullModel, setFullModel] = useState<ThreatModelFull | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await apiListThreatModels(projectId);
      const sortedByDate = [...list].sort(
        (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
      );
      setModels(sortedByDate);
    } catch {
      // silently fail — list stays empty
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setFullModel(null);
      return;
    }
    setExpandedId(id);
    setLoadingId(id);
    try {
      const model = await apiGetThreatModel(id);
      setFullModel(model);
      if (onLoadModel) onLoadModel(model);
    } catch {
      // ignore
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this threat model?')) return;
    setDeletingId(id);
    try {
      await apiDeleteThreatModel(id);
      setModels((prev) => prev.filter((m) => m.id !== id));
      if (expandedId === id) {
        setExpandedId(null);
        setFullModel(null);
      }
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <button
          onClick={onBack}
          className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
        >
          <ChevronLeft size={16} />
        </button>
        <ShieldCheck size={14} className="text-red-500 dark:text-red-400" />
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Saved Threat Models</span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin text-slate-400 dark:text-slate-500" />
          </div>
        ) : models.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No saved threat models yet.
              <br />Run a threat analysis and save it.
            </p>
            {onRunNew && (
              <button
                onClick={onRunNew}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500"
              >
                <ScanSearch size={13} />
                Run analysis
              </button>
            )}
          </div>
        ) : (
          models.map((m, index) => {
            const isExpanded = expandedId === m.id;
            const isLoadingThis = loadingId === m.id;
            const isDeletingThis = deletingId === m.id;
            const isLatest = index === 0;
            const mitigatedPct = m.threatCount > 0
              ? Math.round((m.mitigatedCount / m.threatCount) * 100)
              : 0;

            return (
              <div
                key={m.id}
                className="rounded-xl border border-slate-200 overflow-hidden bg-white dark:border-slate-700 dark:bg-slate-900/50"
              >
                {/* Summary row */}
                <button
                  onClick={() => handleExpand(m.id)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold truncate text-slate-900 dark:text-slate-100">{m.name}</p>
                      {isLatest && (
                        <span className="flex-shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          Latest
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {new Date(m.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        {' · '}v{m.diagramVersion}
                        {' · '}
                        {m.threatCount} threat{m.threatCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <SeverityDots summary={m.severitySummary} />
                      {m.mitigatedCount > 0 && (
                        <span className="text-[10px] text-green-600 dark:text-green-400">
                          {mitigatedPct}% mitigated
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                    {isDeletingThis ? (
                      <Loader2 size={13} className="animate-spin text-slate-400 dark:text-slate-500" />
                    ) : (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleDelete(m.id, e)}
                        onKeyDown={(e) => e.key === 'Enter' && handleDelete(m.id, e as unknown as React.MouseEvent)}
                        className="flex h-6 w-6 items-center justify-center rounded-md transition-colors text-slate-300 hover:bg-red-50 hover:text-red-500 dark:text-slate-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                      >
                        <Trash2 size={11} />
                      </span>
                    )}
                    {isLoadingThis ? (
                      <Loader2 size={13} className="animate-spin text-slate-400 dark:text-slate-500" />
                    ) : isExpanded ? (
                      <ChevronUp size={13} className="text-slate-400 dark:text-slate-500" />
                    ) : (
                      <ChevronDown size={13} className="text-slate-400 dark:text-slate-500" />
                    )}
                  </div>
                </button>

                {/* Expanded threats */}
                {isExpanded && fullModel && fullModel.id === m.id && (
                  <div className="border-t border-slate-200 px-3 py-3 space-y-2 dark:border-slate-700">
                    {fullModel.threats.length === 0 ? (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">No threats in this model.</p>
                    ) : (
                      fullModel.threats.map((t) => (
                        <ThreatResultCard key={t.id} threat={t} isDark={isDark} />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
