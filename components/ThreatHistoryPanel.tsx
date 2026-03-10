'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Trash2, Loader2, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import ThreatResultCard from '@/components/ThreatResultCard';
import {
  apiListThreatModels,
  apiGetThreatModel,
  apiDeleteThreatModel,
  type ThreatModelSummary,
  type ThreatModelFull,
  type ThreatItem,
} from '@/lib/api';

interface ThreatHistoryPanelProps {
  projectId: string;
  isDark: boolean;
  onBack: () => void;
  /** Called when user loads a saved model — parent can use for overlay etc. */
  onLoadModel?: (threats: ThreatItem[]) => void;
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
      setModels(list);
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
      if (onLoadModel) onLoadModel(model.threats);
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

  const border = isDark ? 'border-white/10' : 'border-slate-200';
  const text = isDark ? 'text-white' : 'text-slate-900';
  const subtext = isDark ? 'text-indigo-300/60' : 'text-slate-500';
  const rowHover = isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className={`flex flex-shrink-0 items-center gap-2 border-b px-4 py-3 ${border}`}>
        <button
          onClick={onBack}
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${isDark ? 'text-white/50 hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
        >
          <ChevronLeft size={16} />
        </button>
        <ShieldCheck size={14} className={isDark ? 'text-red-400' : 'text-red-600'} />
        <span className={`text-sm font-semibold ${text}`}>Saved Threat Models</span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className={`animate-spin ${subtext}`} />
          </div>
        ) : models.length === 0 ? (
          <div className={`py-10 text-center text-xs ${subtext}`}>
            No saved threat models yet.
            <br />Run a threat analysis and save it.
          </div>
        ) : (
          models.map((m) => {
            const isExpanded = expandedId === m.id;
            const isLoadingThis = loadingId === m.id;
            const isDeletingThis = deletingId === m.id;
            const mitigatedPct = m.threatCount > 0
              ? Math.round((m.mitigatedCount / m.threatCount) * 100)
              : 0;

            return (
              <div
                key={m.id}
                className={`rounded-xl border overflow-hidden ${border} ${isDark ? 'bg-white/5' : 'bg-white'}`}
              >
                {/* Summary row */}
                <button
                  onClick={() => handleExpand(m.id)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${rowHover}`}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className={`text-xs font-semibold truncate ${text}`}>{m.name}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] ${subtext}`}>
                        {new Date(m.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        {' · '}v{m.diagramVersion}
                        {' · '}
                        {m.threatCount} threat{m.threatCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <SeverityDots summary={m.severitySummary} />
                      {m.mitigatedCount > 0 && (
                        <span className={`text-[10px] ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                          {mitigatedPct}% mitigated
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                    {isDeletingThis ? (
                      <Loader2 size={13} className={`animate-spin ${subtext}`} />
                    ) : (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleDelete(m.id, e)}
                        onKeyDown={(e) => e.key === 'Enter' && handleDelete(m.id, e as unknown as React.MouseEvent)}
                        className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${isDark ? 'text-white/30 hover:bg-white/10 hover:text-red-400' : 'text-slate-300 hover:bg-red-50 hover:text-red-500'}`}
                      >
                        <Trash2 size={11} />
                      </span>
                    )}
                    {isLoadingThis ? (
                      <Loader2 size={13} className={`animate-spin ${subtext}`} />
                    ) : isExpanded ? (
                      <ChevronUp size={13} className={subtext} />
                    ) : (
                      <ChevronDown size={13} className={subtext} />
                    )}
                  </div>
                </button>

                {/* Expanded threats */}
                {isExpanded && fullModel && fullModel.id === m.id && (
                  <div className={`border-t px-3 py-3 space-y-2 ${border}`}>
                    {fullModel.threats.length === 0 ? (
                      <p className={`text-[11px] ${subtext}`}>No threats in this model.</p>
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
