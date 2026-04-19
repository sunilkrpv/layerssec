'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ShieldCheck, X, Loader2, Save, History,
  AlertTriangle, ScanSearch, Plus,
} from 'lucide-react';
import ThreatResultCard from '@/components/ThreatResultCard';
import ThreatHistoryPanel from '@/components/ThreatHistoryPanel';
import {
  type ThreatItem,
  type SavedThreat,
  type ThreatModelFull,
  type ThreatModelSummary,
  type ThreatSeverity,
  type StrideCategory,
  apiUpdateThreat,
  apiDeleteThreat,
  apiCreateThreat,
  apiListThreatModels,
  apiGetThreatModel,
} from '@/lib/api';
import { useTheme } from '@/lib/themeContext';

export interface ThreatModelInfo {
  name: string;
  version?: number;
  isSaved: boolean;
  threatModelId?: string;
}

interface ThreatModelPanelProps {
  currentLayerId: string;
  /** All threats accumulated from AI runs (filtered by layerId inside panel) */
  threats: ThreatItem[];
  modelInfo: ThreatModelInfo | null;
  projectId?: string;
  /** Called when user clicks a threat card — highlights node/edge on canvas */
  onHighlightTarget: (targetId: string) => void;
  /** When the canvas badge is clicked, DiagramPage sets this to scroll the panel to that node's threats */
  externalTargetId?: string | null;
  onExternalTargetConsumed?: () => void;
  /** Opens AI Assistant panel so user can run analysis */
  onOpenAIAssistant: () => void;
  /** Submit analysis as a background job — user can navigate away while it runs */
  onRunAsync?: () => Promise<void>;
  /** Active background job id (non-null while a job is running) */
  activeJobId?: string | null;
  activeJobType?: 'THREAT_ANALYSIS' | 'POSTURE_SCORE' | null;
  /** Save current transient threats as a named model */
  onSave: (name: string) => Promise<void>;
  /** Replace displayed threats with a loaded saved model */
  onLoadModel: (model: ThreatModelFull) => void;
  /** Sync updated threats list back to parent (after CRUD ops on saved model) */
  onThreatsChanged?: (threats: ThreatItem[]) => void;
  onClose: () => void;
}

const SEVERITY_ORDER: ThreatSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const SEVERITY_BADGE: Record<ThreatSeverity, string> = {
  CRITICAL: 'bg-red-500 text-white',
  HIGH: 'bg-orange-500 text-white',
  MEDIUM: 'bg-yellow-400 text-white',
  LOW: 'bg-green-500 text-white',
  INFO: 'bg-slate-400 text-white',
};

const STRIDE_OPTIONS: StrideCategory[] = [
  'SPOOFING', 'TAMPERING', 'REPUDIATION', 'INFORMATION_DISCLOSURE', 'DENIAL_OF_SERVICE', 'ELEVATION_OF_PRIVILEGE',
];

const SEVERITY_OPTIONS: ThreatSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

function isSaved(t: ThreatItem): t is SavedThreat {
  return 'id' in t;
}

const EMPTY_FORM = {
  title: '',
  description: '',
  targetLabel: '',
  strideCategory: 'SPOOFING' as StrideCategory,
  severity: 'MEDIUM' as ThreatSeverity,
};

export default function ThreatModelPanel({
  currentLayerId,
  threats,
  modelInfo,
  projectId,
  onHighlightTarget,
  externalTargetId,
  onExternalTargetConsumed,
  onOpenAIAssistant,
  onRunAsync,
  activeJobId,
  activeJobType,
  onSave,
  onLoadModel,
  onThreatsChanged,
  onClose,
}: ThreatModelPanelProps) {
  const { theme } = useTheme();
  const [systemDark, setSystemDark] = useState(
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  const isDark = theme === 'dark' || (theme === 'system' && systemDark);

  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [showHistory, setShowHistory] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [isAdding, setIsAdding] = useState(false);
  const [savedSummaries, setSavedSummaries] = useState<ThreatModelSummary[] | null>(null);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [loadingSummaryId, setLoadingSummaryId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const threatModelId = modelInfo?.threatModelId;

  // Filter to current layer, sorted by severity
  const layerThreats = threats.filter((t) => t.layerId === currentLayerId);
  const sorted = [...layerThreats].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  // Severity summary counts (exclude false positives)
  const activeThreats = layerThreats.filter((t) => !isSaved(t) || t.status !== 'FALSE_POSITIVE');
  const severityCounts = SEVERITY_ORDER.reduce<Record<string, number>>((acc, sev) => {
    const n = activeThreats.filter((t) => t.severity === sev).length;
    if (n > 0) acc[sev] = n;
    return acc;
  }, {});

  // Reset focused index when layer changes
  useEffect(() => { setFocusedIndex(-1); }, [currentLayerId]);

  // When canvas badge clicked, scroll panel to the first threat for that node
  useEffect(() => {
    if (!externalTargetId) return;
    const idx = sorted.findIndex((t) => t.targetId === externalTargetId);
    if (idx >= 0) {
      setFocusedIndex(idx);
      cardRefs.current[idx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    onExternalTargetConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalTargetId]);

  // Keyboard navigation — up/down arrows when panel is visible
  useEffect(() => {
    if (showHistory || sorted.length === 0) return;
    const handleKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev < sorted.length - 1 ? prev + 1 : 0;
          cardRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          onHighlightTarget(sorted[next].targetId);
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : sorted.length - 1;
          cardRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          onHighlightTarget(sorted[next].targetId);
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [sorted, showHistory, onHighlightTarget]);

  const handleCardClick = (t: ThreatItem, index: number) => {
    setFocusedIndex(index);
    onHighlightTarget(t.targetId);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(saveName || 'Threat Analysis');
      setSaveName('');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadFromHistory = useCallback((model: ThreatModelFull) => {
    onLoadModel(model);
    setShowHistory(false);
  }, [onLoadModel]);

  // Fetch saved threat model summaries when the panel has no transient analysis.
  // Sorted newest-first so `[0]` is the most recent.
  useEffect(() => {
    if (!projectId || threats.length > 0) {
      setSavedSummaries(null);
      return;
    }
    let cancelled = false;
    setIsLoadingSaved(true);
    apiListThreatModels(projectId)
      .then((list) => {
        if (cancelled) return;
        const sortedByDate = [...list].sort(
          (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
        );
        setSavedSummaries(sortedByDate);
      })
      .catch(() => {
        if (!cancelled) setSavedSummaries([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSaved(false);
      });
    return () => { cancelled = true; };
  }, [projectId, threats.length]);

  const handleLoadSummary = useCallback(async (summaryId: string) => {
    setLoadingSummaryId(summaryId);
    try {
      const full = await apiGetThreatModel(summaryId);
      onLoadModel(full);
    } finally {
      setLoadingSummaryId(null);
    }
  }, [onLoadModel]);

  // ── CRUD handlers for saved threats ───────────────────────────────────────

  const handleDismiss = async (t: SavedThreat) => {
    if (!threatModelId) return;
    const newStatus = t.status === 'FALSE_POSITIVE' ? 'IDENTIFIED' : 'FALSE_POSITIVE';
    const updated = await apiUpdateThreat(threatModelId, t.id, { status: newStatus });
    onThreatsChanged?.(threats.map((x) => (isSaved(x) && x.id === t.id ? updated : x)));
  };

  const handleDelete = async (t: SavedThreat) => {
    if (!threatModelId) return;
    await apiDeleteThreat(threatModelId, t.id);
    onThreatsChanged?.(threats.filter((x) => !(isSaved(x) && x.id === t.id)));
  };

  const handleAddThreat = async () => {
    if (!threatModelId || !addForm.title.trim()) return;
    setIsAdding(true);
    try {
      const created = await apiCreateThreat(threatModelId, {
        targetId: `user-${Date.now()}`,
        targetType: 'node',
        targetLabel: addForm.targetLabel || 'General',
        layerId: currentLayerId,
        strideCategory: addForm.strideCategory,
        title: addForm.title,
        description: addForm.description,
        severity: addForm.severity,
      });
      onThreatsChanged?.([...threats, created]);
      setAddForm(EMPTY_FORM);
      setShowAddForm(false);
    } finally {
      setIsAdding(false);
    }
  };

  const canEdit = modelInfo?.isSaved && !!threatModelId;

  return (
    <aside className="relative flex h-full w-[425px] flex-shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {!showHistory && (
        <div className="relative flex flex-shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-red-50 ring-1 ring-red-200 dark:bg-slate-700 dark:ring-slate-600">
            <ShieldCheck size={17} className="text-red-600 dark:text-red-400" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-slate-900 dark:text-slate-100">Threat Model</span>
              {modelInfo && (
                <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                  modelInfo.isSaved
                    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-700/50 dark:bg-green-900/20 dark:text-green-400'
                    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-400'
                }`}>
                  {modelInfo.isSaved ? <ShieldCheck size={9} /> : <AlertTriangle size={9} />}
                  {modelInfo.isSaved ? 'saved' : 'unsaved'}
                </span>
              )}
            </div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-400">
              {modelInfo
                ? `${modelInfo.name}${modelInfo.version !== undefined ? ` · v${modelInfo.version}` : ''}`
                : 'No analysis loaded'}
            </div>
          </div>

          {/* Add threat button (only for saved models) */}
          {canEdit && (
            <button
              onClick={() => setShowAddForm((v) => !v)}
              title="Add a threat manually"
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
                showAddForm
                  ? 'bg-red-600 text-white'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Plus size={15} />
            </button>
          )}

          {/* History button — labeled pill, with count when known */}
          {projectId && (
            <button
              onClick={() => setShowHistory(true)}
              title="Saved threat models"
              className="flex h-7 flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
            >
              <History size={13} />
              <span>History</span>
              {savedSummaries && savedSummaries.length > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {savedSummaries.length}
                </span>
              )}
            </button>
          )}

          <button
            onClick={onClose}
            title="Close Threat Model panel (⌘⇧M)"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── History sub-view ────────────────────────────────────────────────── */}
      {showHistory && projectId && (
        <ThreatHistoryPanel
          projectId={projectId}
          isDark={isDark}
          onBack={() => setShowHistory(false)}
          onLoadModel={handleLoadFromHistory}
          onRunNew={onRunAsync ? () => {
            setShowHistory(false);
            void onRunAsync();
          } : undefined}
        />
      )}

      {/* ── Main content ────────────────────────────────────────────────────── */}
      {!showHistory && (
        <>
          {/* Inline "Add Threat" form */}
          {showAddForm && canEdit && (
            <div className="flex-shrink-0 border-b border-slate-200 px-4 py-3 space-y-2 bg-slate-50 dark:bg-slate-900/30 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Add Threat</p>
              <input
                value={addForm.title}
                onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Title *"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none placeholder-slate-400 focus:ring-1 focus:ring-red-400/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
              />
              <input
                value={addForm.targetLabel}
                onChange={(e) => setAddForm((f) => ({ ...f, targetLabel: e.target.value }))}
                placeholder="Target node / component"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none placeholder-slate-400 focus:ring-1 focus:ring-red-400/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
              />
              <div className="flex gap-2">
                <select
                  value={addForm.strideCategory}
                  onChange={(e) => setAddForm((f) => ({ ...f, strideCategory: e.target.value as StrideCategory }))}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                >
                  {STRIDE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <select
                  value={addForm.severity}
                  onChange={(e) => setAddForm((f) => ({ ...f, severity: e.target.value as ThreatSeverity }))}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                >
                  {SEVERITY_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <textarea
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Description"
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none placeholder-slate-400 resize-none focus:ring-1 focus:ring-red-400/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowAddForm(false); setAddForm(EMPTY_FORM); }}
                  className="flex-1 rounded-lg border border-slate-200 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddThreat}
                  disabled={isAdding || !addForm.title.trim()}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-600 py-1.5 text-sm font-medium text-white hover:bg-red-500 transition disabled:opacity-50"
                >
                  {isAdding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Severity summary bar */}
          {layerThreats.length > 0 && (
            <div className="flex flex-shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {activeThreats.length} threat{activeThreats.length !== 1 ? 's' : ''}
              </span>
              {sorted.length > 0 && focusedIndex >= 0 && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  · {focusedIndex + 1} / {sorted.length} selected
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                {Object.entries(severityCounts).map(([sev, count]) => (
                  <span
                    key={sev}
                    title={`${count} ${sev}`}
                    className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-bold ${SEVERITY_BADGE[sev as ThreatSeverity]}`}
                  >
                    {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Background job running banner ── */}
          {activeJobId && (
            <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-violet-300/40 bg-violet-50 px-3 py-2.5 dark:border-violet-500/20 dark:bg-violet-900/20">
              <Loader2 size={14} className="animate-spin flex-shrink-0 text-violet-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                  {activeJobType === 'THREAT_ANALYSIS' ? 'Threat analysis' : 'Posture score'} running in background
                </p>
                <p className="text-xs text-violet-500 dark:text-violet-400">Results will appear here when complete. You can safely navigate away.</p>
              </div>
            </div>
          )}

          {/* Threat list / empty states */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3">
            {threats.length === 0 && !activeJobId ? (
              isLoadingSaved ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={20} className="animate-spin text-slate-400 dark:text-slate-500" />
                </div>
              ) : savedSummaries && savedSummaries.length > 0 ? (
                <div className="space-y-4 py-2">
                  {/* Header */}
                  <div className="flex items-center gap-3 px-1">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-50 ring-1 ring-red-200 dark:bg-slate-700 dark:ring-slate-600">
                      <ShieldCheck size={18} className="text-red-600 dark:text-red-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {savedSummaries.length} saved threat model{savedSummaries.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Pick up where you left off, or run a new analysis.</p>
                    </div>
                  </div>

                  {/* Most-recent summary card — clickable */}
                  {(() => {
                    const m = savedSummaries[0];
                    const isLoadingThis = loadingSummaryId === m.id;
                    const mitigatedPct = m.threatCount > 0
                      ? Math.round((m.mitigatedCount / m.threatCount) * 100)
                      : 0;
                    return (
                      <button
                        onClick={() => void handleLoadSummary(m.id)}
                        disabled={isLoadingThis}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-red-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-red-500/40 disabled:opacity-60"
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{m.name}</p>
                              <span className="flex-shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                Latest
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {new Date(m.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              {' · '}v{m.diagramVersion}
                              {' · '}
                              {m.threatCount} threat{m.threatCount !== 1 ? 's' : ''}
                              {m.mitigatedCount > 0 && (
                                <span className="text-green-600 dark:text-green-400">{' · '}{mitigatedPct}% mitigated</span>
                              )}
                            </p>
                            <div className="flex flex-wrap items-center gap-1 pt-0.5">
                              {Object.entries(m.severitySummary)
                                .filter(([, count]) => count > 0)
                                .map(([sev, count]) => (
                                  <span
                                    key={sev}
                                    title={`${count} ${sev}`}
                                    className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold ${SEVERITY_BADGE[sev as ThreatSeverity]}`}
                                  >
                                    {count}
                                  </span>
                                ))}
                            </div>
                          </div>
                          {isLoadingThis && <Loader2 size={14} className="mt-0.5 animate-spin text-slate-400 dark:text-slate-500" />}
                        </div>
                      </button>
                    );
                  })()}

                  {/* Primary CTA — view all */}
                  <button
                    onClick={() => setShowHistory(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500"
                  >
                    <History size={14} />
                    View all saved threat models
                  </button>

                  {/* Secondary — run new analysis */}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">or</span>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  </div>
                  <div className="flex flex-col items-stretch gap-2">
                    {onRunAsync && (
                      <button
                        onClick={() => void onRunAsync()}
                        className="flex items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-100 dark:border-violet-500/40 dark:bg-violet-900/20 dark:text-violet-300 dark:hover:bg-violet-900/40"
                      >
                        <ScanSearch size={13} />
                        Run new analysis
                      </button>
                    )}
                    <button
                      onClick={onOpenAIAssistant}
                      className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                    >
                      <ScanSearch size={13} />
                      Open AI Assistant
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700">
                    <ShieldCheck size={24} className="text-red-300 dark:text-red-500/60" />
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">No threat analysis yet</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Analyse in the background and keep working, or open the AI Assistant.</p>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    {onRunAsync && (
                      <button
                        onClick={() => void onRunAsync()}
                        className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500"
                      >
                        <ScanSearch size={14} />
                        Analyse in background
                      </button>
                    )}
                    <button
                      onClick={onOpenAIAssistant}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                    >
                      <ScanSearch size={14} />
                      Open AI Assistant
                    </button>
                  </div>
                </div>
              )
            ) : layerThreats.length === 0 && !activeJobId ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">No threats for this layer</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Switch to a layer that has been analyzed, or run a new analysis.</p>
                <div className="flex items-center gap-2">
                  {onRunAsync && (
                    <button
                      onClick={() => void onRunAsync()}
                      className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
                    >
                      <ScanSearch size={13} />
                      Analyse in background
                    </button>
                  )}
                  <button
                    onClick={onOpenAIAssistant}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                  >
                    <ScanSearch size={13} />
                    AI Assistant
                  </button>
                </div>
              </div>
            ) : layerThreats.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">Results will appear here when the analysis completes.</div>
            ) : (
              <div className="space-y-2.5">
                {sorted.map((t, i) => (
                  <div
                    key={isSaved(t) ? t.id : `${t.targetId}-${t.strideCategory}-${i}`}
                    ref={(el) => { cardRefs.current[i] = el; }}
                  >
                    <ThreatResultCard
                      threat={t}
                      onClick={() => handleCardClick(t, i)}
                      isActive={focusedIndex === i}
                      onDismiss={canEdit && isSaved(t) ? () => handleDismiss(t) : undefined}
                      onDelete={canEdit && isSaved(t) ? () => handleDelete(t) : undefined}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Footer: save section ───────────────────────────────────────── */}
          {threats.length > 0 && !modelInfo?.isSaved && (
            <div className="flex-shrink-0 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Save this analysis
              </p>
              <div className="flex items-center gap-2">
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Model name (optional)"
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none placeholder-slate-400 focus:ring-1 focus:ring-blue-400/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
