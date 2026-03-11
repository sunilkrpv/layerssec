'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ShieldCheck, X, Loader2, Save, History,
  AlertTriangle, ScanSearch,
} from 'lucide-react';
import ThreatResultCard from '@/components/ThreatResultCard';
import ThreatHistoryPanel from '@/components/ThreatHistoryPanel';
import {
  type ThreatItem,
  type ThreatModelFull,
  type ThreatSeverity,
} from '@/lib/api';
import { useTheme } from '@/lib/themeContext';

export interface ThreatModelInfo {
  name: string;
  version?: number;
  isSaved: boolean;
}

interface ThreatModelPanelProps {
  currentLayerId: string;
  /** All threats accumulated from AI runs (filtered by layerId inside panel) */
  threats: ThreatItem[];
  modelInfo: ThreatModelInfo | null;
  projectId?: string;
  /** Called when user clicks a threat card — highlights node/edge on canvas */
  onHighlightTarget: (targetId: string) => void;
  /** Opens AI Assistant panel so user can run analysis */
  onOpenAIAssistant: () => void;
  /** Save current transient threats as a named model */
  onSave: (name: string) => Promise<void>;
  /** Replace displayed threats with a loaded saved model */
  onLoadModel: (model: ThreatModelFull) => void;
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

export default function ThreatModelPanel({
  currentLayerId,
  threats,
  modelInfo,
  projectId,
  onHighlightTarget,
  onOpenAIAssistant,
  onSave,
  onLoadModel,
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
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Filter to current layer, sorted by severity
  const layerThreats = threats.filter((t) => t.layerId === currentLayerId);
  const sorted = [...layerThreats].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  // Severity summary counts
  const severityCounts = SEVERITY_ORDER.reduce<Record<string, number>>((acc, sev) => {
    const n = layerThreats.filter((t) => t.severity === sev).length;
    if (n > 0) acc[sev] = n;
    return acc;
  }, {});

  // Reset focused index when layer changes
  useEffect(() => { setFocusedIndex(-1); }, [currentLayerId]);

  // Keyboard navigation — up/down arrows when panel is visible
  useEffect(() => {
    if (showHistory || sorted.length === 0) return;
    const handleKey = (e: KeyboardEvent) => {
      // Don't steal keys from input fields
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

          {/* History button */}
          {projectId && (
            <button
              onClick={() => setShowHistory(true)}
              title="Saved threat models"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            >
              <History size={15} />
            </button>
          )}

          <button
            onClick={onClose}
            title="Close Threat Model panel (⌘T)"
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
        />
      )}

      {/* ── Main content ────────────────────────────────────────────────────── */}
      {!showHistory && (
        <>
          {/* Severity summary bar */}
          {layerThreats.length > 0 && (
            <div className="flex flex-shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {layerThreats.length} threat{layerThreats.length !== 1 ? 's' : ''}
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

          {/* Threat list / empty states */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3">
            {threats.length === 0 ? (
              /* No analysis has been run at all */
              <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700">
                  <ShieldCheck size={24} className="text-red-300 dark:text-red-500/60" />
                </div>
                <div>
                  <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">No threat analysis yet</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Run a STRIDE analysis from the AI Assistant to populate this panel.</p>
                </div>
                <button
                  onClick={onOpenAIAssistant}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                >
                  <ScanSearch size={14} />
                  Open AI Assistant
                </button>
              </div>
            ) : layerThreats.length === 0 ? (
              /* Analysis exists but not for this layer */
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">No threats for this layer</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Switch to a layer that has been analyzed, or run a new analysis.</p>
                <button
                  onClick={onOpenAIAssistant}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                >
                  <ScanSearch size={13} />
                  Analyze this layer
                </button>
              </div>
            ) : (
              /* Threats for current layer */
              <div className="space-y-2.5">
                {sorted.map((t, i) => (
                  <div
                    key={`${t.targetId}-${t.strideCategory}`}
                    ref={(el) => { cardRefs.current[i] = el; }}
                  >
                    <ThreatResultCard
                      threat={t}
                      onClick={() => handleCardClick(t, i)}
                      isActive={focusedIndex === i}
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
