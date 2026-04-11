'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sword, X, Loader2, Save, ChevronDown, ChevronRight, Zap,
  AlertTriangle, Flag, Target, Shield, Eye, Trash2, Play, Clock,
  ChevronLeft, RotateCcw,
} from 'lucide-react';
import {
  type AttackMindResult,
  type AttackPath,
  type AttackSimulation,
  apiRunAttackMind,
  apiSaveAttackSimulation,
  apiListAttackSimulations,
  apiDeleteAttackSimulation,
} from '@/lib/api';
import { useTheme } from '@/lib/themeContext';

// ── Type helpers ──────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

const LIKELIHOOD_COLORS: Record<string, string> = {
  HIGH: 'text-red-500 dark:text-red-400',
  MEDIUM: 'text-amber-500 dark:text-amber-400',
  LOW: 'text-green-500 dark:text-green-400',
};

const STEP_LIKELIHOOD_DOT: Record<string, string> = {
  HIGH: 'bg-red-500',
  MEDIUM: 'bg-amber-400',
  LOW: 'bg-green-500',
};

// ── Attack Path Card ──────────────────────────────────────────────────────────

interface PathCardProps {
  path: AttackPath;
  index: number;
  activeStepKey: string | null;
  activeTimelineStepIndex: number | null; // step index driven by timeline (not hover)
  onStepHover: (key: string | null, nodeIds: string[], edgeIds: string[]) => void;
  isSelected: boolean;
  onSelect: () => void;
  onAnimate: () => void;
}

function PathCard({
  path, index, activeStepKey, activeTimelineStepIndex,
  onStepHover, isSelected, onSelect, onAnimate,
}: PathCardProps) {
  const [open, setOpen] = useState(index === 0);

  return (
    <div className={`rounded-xl border transition-colors ${isSelected ? 'border-blue-400 dark:border-blue-500' : 'border-slate-200 dark:border-slate-700'}`}>
      {/* Path header */}
      <button
        onClick={() => { setOpen((v) => !v); onSelect(); }}
        className="flex w-full items-start gap-3 p-3.5 text-left"
      >
        <span className={`mt-0.5 shrink-0 rounded-md px-2 py-1 text-xs font-bold ${SEVERITY_COLORS[path.severity] ?? SEVERITY_COLORS.MEDIUM}`}>
          {path.severity}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{path.title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Entry: <span className="text-slate-600 dark:text-slate-300">{path.entryPointLabel}</span>
            {' · '}
            <span className={`font-medium ${LIKELIHOOD_COLORS[path.likelihood]}`}>{path.likelihood} likelihood</span>
          </p>
        </div>
        {open
          ? <ChevronDown size={15} className="shrink-0 text-slate-400 mt-1" />
          : <ChevronRight size={15} className="shrink-0 text-slate-400 mt-1" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-700/60 px-3.5 pb-3.5 pt-3 flex flex-col gap-4">
          {/* Summary */}
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{path.summary}</p>

          {/* Kill chain steps */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Kill Chain</p>
            <div className="flex flex-col gap-1.5">
              {path.steps.map((step, stepIdx) => {
                const key = `${path.pathId}-step-${step.stepNumber}`;
                const isHoverActive = activeStepKey === key;
                const isTimelineActive = activeTimelineStepIndex === stepIdx;
                const isActive = isHoverActive || isTimelineActive;
                return (
                  <div
                    key={step.stepNumber}
                    className={`rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                      isTimelineActive
                        ? 'bg-red-50 dark:bg-red-900/20 ring-1 ring-red-400 dark:ring-red-600'
                        : isHoverActive
                        ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-300 dark:ring-blue-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                    }`}
                    onMouseEnter={() => onStepHover(key, step.nodeIds, step.edgeIds ?? [])}
                    onMouseLeave={() => onStepHover(null, [], [])}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isActive
                          ? 'bg-red-500 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        {step.stepNumber}
                      </span>
                      <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{step.action}</span>
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STEP_LIKELIHOOD_DOT[step.successLikelihood]}`} title={`${step.successLikelihood} success likelihood`} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono pl-7">{step.attackTechnique}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed pl-7">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Animate this path button */}
          <button
            onClick={onAnimate}
            className="flex items-center justify-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 transition hover:bg-red-100 dark:hover:bg-red-900/30"
          >
            <Play size={13} />
            Animate this path on canvas
          </button>

          {/* Crown jewels */}
          {path.crownJewelNodeIds.length > 0 && (
            <div className="flex items-start gap-2">
              <Target size={14} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-red-500">Crown jewels:</span>{' '}
                {path.crownJewelNodeIds.join(', ')}
              </p>
            </div>
          )}

          {/* Mitigations */}
          {path.mitigations.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Shield size={13} className="text-green-500" />
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mitigations</p>
              </div>
              <ul className="flex flex-col gap-1">
                {path.mitigations.map((m, i) => (
                  <li key={i} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
                    <span className="mt-0.5 text-green-500 shrink-0">•</span>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step Timeline Bar ─────────────────────────────────────────────────────────

interface TimelineBarProps {
  path: AttackPath;
  stepIndex: number;
  isPlaying: boolean;
  isDark: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPlay: () => void;
  onReset: () => void;
}

function TimelineBar({ path, stepIndex, isPlaying, isDark, onPrev, onNext, onPlay, onReset }: TimelineBarProps) {
  const step = path.steps[stepIndex];
  if (!step) return null;
  const total = path.steps.length;

  return (
    <div className={`shrink-0 border-t px-4 py-3 flex flex-col gap-2.5 ${isDark ? 'border-red-900/40 bg-red-950/30' : 'border-red-100 bg-red-50/60'}`}>
      {/* Path label */}
      <div className="flex items-center gap-2">
        <Sword size={12} className="shrink-0 text-red-500" />
        <span className="text-xs font-semibold text-red-600 dark:text-red-400 truncate">{path.title}</span>
      </div>

      {/* Step label */}
      <div className="flex items-center gap-2">
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white`}>
          {step.stepNumber}
        </span>
        <p className="flex-1 min-w-0 text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{step.action}</p>
        <span className="text-xs text-slate-400 shrink-0">{stepIndex + 1}/{total}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-1 rounded-full bg-red-500 transition-all duration-300"
          style={{ width: `${((stepIndex + 1) / total) * 100}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={stepIndex === 0}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft size={13} /> Prev
        </button>
        <button
          onClick={onNext}
          disabled={stepIndex === total - 1}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Next <ChevronRight size={13} />
        </button>
        <button
          onClick={onPlay}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            isPlaying
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {isPlaying
            ? <><Loader2 size={12} className="animate-spin" /> Playing…</>
            : <><Play size={12} /> Play All</>}
        </button>
        <button
          onClick={onReset}
          title="Reset"
          className="rounded-lg p-1.5 text-slate-400 hover:text-red-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Saved Simulations List ────────────────────────────────────────────────────

function SavedSimulationsList({
  simulations,
  onLoad,
  onDelete,
}: {
  simulations: AttackSimulation[];
  onLoad: (sim: AttackSimulation) => void;
  onDelete: (id: string) => void;
}) {
  if (simulations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
        <Sword size={28} className="text-slate-300 dark:text-slate-600" />
        <p className="text-sm text-slate-400">No saved simulations yet. Run and save your first simulation.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700/60 py-1">
      {simulations.map((sim) => {
        const paths: AttackPath[] = sim.paths ?? [];
        const critCount = paths.filter((p) => p.severity === 'CRITICAL').length;
        const highCount = paths.filter((p) => p.severity === 'HIGH').length;
        const isNewFormat = !sim.paths && !!sim.content;
        return (
          <div key={sim.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/40">
            {/* Icon */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/20">
              <Sword size={15} className="text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{sim.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Clock size={11} className="text-slate-400" />
                <span className="text-xs text-slate-400">{new Date(sim.createdAt).toLocaleDateString()}</span>
                {isNewFormat
                  ? <span className="text-xs text-slate-400">· narrative report</span>
                  : <span className="text-xs text-slate-400">· {paths.length} paths</span>}
                {critCount > 0 && <span className="text-xs text-red-500 font-semibold">{critCount} CRITICAL</span>}
                {highCount > 0 && <span className="text-xs text-orange-500 font-semibold">{highCount} HIGH</span>}
              </div>
            </div>
            <button
              onClick={() => onLoad(sim)}
              title="Load simulation"
              className="rounded-lg p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Eye size={15} />
            </button>
            <button
              onClick={() => onDelete(sim.id)}
              title="Delete"
              className="rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export interface AttackMindHighlight {
  nodeIds: string[];
  edgeIds: string[];
  stepKey: string | null;
  pathId: string | null;
}

interface AttackMindPanelProps {
  projectId: string;
  diagramId: string;
  layers: Record<string, unknown>;
  /** Node selected on canvas for "simulate from here" — pre-fills entry point */
  initialEntryNodeId?: string | null;
  onHighlightChange: (highlight: AttackMindHighlight) => void;
  onClose: () => void;
}

type Tab = 'simulation' | 'history';

export default function AttackMindPanel({
  projectId,
  diagramId,
  layers,
  initialEntryNodeId,
  onHighlightChange,
  onClose,
}: AttackMindPanelProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<Tab>('simulation');
  const [result, setResult] = useState<AttackMindResult | null>(null);
  const [narrativeContent, setNarrativeContent] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [rawBuffer, setRawBuffer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [useExtended, setUseExtended] = useState(false);
  const [entryNodeId, setEntryNodeId] = useState(initialEntryNodeId ?? '');
  const [activeStepKey, setActiveStepKey] = useState<string | null>(null);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);

  // Timeline state
  const [timelinePath, setTimelinePath] = useState<AttackPath | null>(null);
  const [timelineStepIndex, setTimelineStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save flow
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // History
  const [simulations, setSimulations] = useState<AttackSimulation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const abortRef = useRef<AbortController | null>(null);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const sims = await apiListAttackSimulations(projectId);
      setSimulations(sims);
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  }, [projectId]);

  // Load history on mount
  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Emit highlight whenever timeline step changes
  useEffect(() => {
    if (!timelinePath) return;
    const step = timelinePath.steps[timelineStepIndex];
    if (!step) return;
    onHighlightChange({
      nodeIds: step.nodeIds,
      edgeIds: step.edgeIds ?? [],
      stepKey: `${timelinePath.pathId}-step-${step.stepNumber}`,
      pathId: timelinePath.pathId,
    });
  }, [timelinePath, timelineStepIndex, onHighlightChange]);

  // Auto-play: advance step every 1.2s
  useEffect(() => {
    if (!isPlaying || !timelinePath) return;
    playTimerRef.current = setTimeout(() => {
      setTimelineStepIndex((prev) => {
        const next = prev + 1;
        if (next >= timelinePath.steps.length) {
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, 1200);
    return () => { if (playTimerRef.current) clearTimeout(playTimerRef.current); };
  }, [isPlaying, timelinePath, timelineStepIndex]);

  const handleAnimatePath = useCallback((path: AttackPath) => {
    setTimelinePath(path);
    setTimelineStepIndex(0);
    setIsPlaying(false);
    setSelectedPathId(path.pathId);
  }, []);

  const handleTimelineReset = useCallback(() => {
    setIsPlaying(false);
    if (playTimerRef.current) clearTimeout(playTimerRef.current);
    setTimelinePath(null);
    setTimelineStepIndex(0);
    onHighlightChange({ nodeIds: [], edgeIds: [], stepKey: null, pathId: null });
  }, [onHighlightChange]);

  const handleTimelinePrev = useCallback(() => {
    setIsPlaying(false);
    setTimelineStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleTimelineNext = useCallback(() => {
    setIsPlaying(false);
    if (!timelinePath) return;
    setTimelineStepIndex((prev) => Math.min(timelinePath.steps.length - 1, prev + 1));
  }, [timelinePath]);

  const handleTimelinePlay = useCallback(() => {
    if (!timelinePath) return;
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    // If at last step, restart from beginning
    if (timelineStepIndex >= timelinePath.steps.length - 1) {
      setTimelineStepIndex(0);
    }
    setIsPlaying(true);
  }, [isPlaying, timelinePath, timelineStepIndex]);

  const handleRun = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setStreaming(true);
    setResult(null);
    setNarrativeContent(null);
    setRawBuffer('');
    setError(null);
    setShowSave(false);
    setSavedSuccess(false);
    setActiveTab('simulation');
    handleTimelineReset();

    let accumulated = '';
    try {
      await apiRunAttackMind(
        {
          projectId,
          diagramId,
          layers,
          entryPointNodeId: entryNodeId || undefined,
          useExtendedThinking: useExtended,
        },
        (chunk) => {
          accumulated += chunk;
          setRawBuffer(accumulated);
        },
      );
      const cleaned = accumulated.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
      const parsed = JSON.parse(cleaned) as AttackMindResult;
      setResult(parsed);
      setShowSave(true);
      setSaveName(`Attack Simulation — ${new Date().toLocaleDateString()}`);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError(e instanceof Error ? e.message : 'Simulation failed');
      }
    } finally {
      setStreaming(false);
      setRawBuffer('');
    }
  }, [projectId, diagramId, layers, entryNodeId, useExtended, handleTimelineReset]);

  const handleSave = useCallback(async () => {
    if (!result) return;
    setSaving(true);
    try {
      await apiSaveAttackSimulation({
        projectId,
        diagramId,
        name: saveName || 'Attack Simulation',
        entryPointId: entryNodeId || undefined,
        paths: result.paths,
      });
      setShowSave(false);
      setSavedSuccess(true);
      loadHistory();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [result, projectId, diagramId, saveName, entryNodeId, loadHistory]);

  const handleLoadSim = useCallback((sim: AttackSimulation) => {
    setNarrativeContent(null);
    if (sim.paths) {
      // Legacy format: structured paths array
      setResult({ entryPointAnalysis: '', paths: sim.paths as AttackPath[] });
    } else if (sim.content) {
      // New format (PRD9): try JSON first, fall back to markdown narrative
      try {
        const cleaned = sim.content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          // Saved as bare paths array (current save format)
          setResult({ entryPointAnalysis: '', paths: parsed as AttackPath[] });
        } else {
          setResult(parsed as AttackMindResult);
        }
      } catch {
        // Plain markdown narrative — render directly
        setNarrativeContent(sim.content);
        setResult(null);
      }
    } else {
      setResult({ entryPointAnalysis: '', paths: [] });
    }
    setActiveTab('simulation');
    setShowSave(false);
    handleTimelineReset();
  }, [handleTimelineReset]);

  const handleDeleteSim = useCallback(async (id: string) => {
    await apiDeleteAttackSimulation(id);
    setSimulations((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleStepHover = useCallback((
    key: string | null,
    nodeIds: string[],
    edgeIds: string[],
  ) => {
    // Only drive hover highlights if no timeline is active
    if (timelinePath) return;
    setActiveStepKey(key);
    onHighlightChange({
      nodeIds,
      edgeIds,
      stepKey: key,
      pathId: selectedPathId,
    });
  }, [onHighlightChange, selectedPathId, timelinePath]);

  // ── Footer controls (always visible) ─────────────────────────────────────
  const Footer = (
    <div className={`shrink-0 border-t px-4 py-3 flex flex-col gap-2.5 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
      {/* Entry point input */}
      <div className="flex items-center gap-2.5">
        <label className="text-sm text-slate-500 shrink-0 w-24">Entry node ID</label>
        <input
          value={entryNodeId}
          onChange={(e) => setEntryNodeId(e.target.value)}
          placeholder="optional — auto-detected"
          className={`flex-1 min-w-0 rounded-lg border px-3 py-1.5 text-sm ${isDark ? 'border-slate-600 bg-slate-700 text-slate-100 placeholder:text-slate-500' : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400'}`}
        />
      </div>
      {/* Extended thinking toggle */}
      <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={useExtended}
          onChange={(e) => setUseExtended(e.target.checked)}
          className="rounded accent-purple-500"
        />
        <Zap size={13} className="text-purple-500" />
        Use extended thinking (deep red-team analysis)
      </label>
      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={streaming}
        className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
      >
        {streaming ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
        {streaming ? 'Simulating…' : result ? 'Re-run Simulation' : 'Run Simulation'}
      </button>
    </div>
  );

  return (
    <div
      className={`flex h-full flex-col border-l ${isDark ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'}`}
      style={{ width: 480 }}
    >
      {/* ── Header ── */}
      <div className={`flex h-10 shrink-0 items-center gap-2.5 border-b px-4 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
        <Sword size={15} className="text-red-500" />
        <span className="flex-1 text-sm font-semibold">Attack Mind Simulator</span>
        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
          <X size={15} />
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className={`flex shrink-0 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
        {(['simulation', 'history'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab
                ? 'border-red-500 text-red-600 dark:text-red-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {tab === 'simulation' ? <Sword size={13} /> : <Flag size={13} />}
            {tab === 'simulation' ? 'Simulation' : `Saved${simulations.length > 0 ? ` (${simulations.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* ── Simulation Tab ── */}
      {activeTab === 'simulation' && (
        <>
          <div className="flex-1 overflow-y-auto">

            {/* Streaming indicator */}
            {streaming && (
              <div className="flex flex-col items-center gap-4 py-16 px-6">
                <div className="relative">
                  <Loader2 size={40} className="animate-spin text-red-500" />
                  <Sword size={18} className="absolute inset-0 m-auto text-red-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    {useExtended ? 'Deep red-team analysis in progress…' : 'Simulating attack paths…'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">This may take 20–40 seconds</p>
                </div>
                {rawBuffer.length > 0 && (
                  <p className="text-xs text-slate-400 font-mono">{rawBuffer.length} bytes received</p>
                )}
              </div>
            )}

            {/* Error */}
            {!streaming && error && (
              <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              </div>
            )}

            {/* Results */}
            {!streaming && result && (
              <div className="p-4 flex flex-col gap-4">
                {/* Save success banner */}
                {savedSuccess && (
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 px-3 py-2">
                    <Flag size={13} className="text-green-500 shrink-0" />
                    <span className="text-sm text-green-700 dark:text-green-300 flex-1">Simulation saved successfully.</span>
                    <button onClick={() => setActiveTab('history')} className="text-xs text-blue-500 hover:text-blue-600 font-medium shrink-0">View →</button>
                  </div>
                )}

                {result.entryPointAnalysis && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertTriangle size={13} className="text-red-500 shrink-0" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-red-500">Entry Point Analysis</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{result.entryPointAnalysis}</p>
                  </div>
                )}

                <div className="flex flex-col gap-2.5">
                  {(result.paths ?? []).map((path, i) => (
                    <PathCard
                      key={path.pathId}
                      path={path}
                      index={i}
                      activeStepKey={activeStepKey}
                      activeTimelineStepIndex={timelinePath?.pathId === path.pathId ? timelineStepIndex : null}
                      onStepHover={handleStepHover}
                      isSelected={selectedPathId === path.pathId}
                      onSelect={() => setSelectedPathId(path.pathId)}
                      onAnimate={() => handleAnimatePath(path)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Narrative content (new-format simulations) */}
            {!streaming && narrativeContent && (
              <div className="p-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{narrativeContent}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!streaming && !result && !narrativeContent && !error && (
              <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
                  <Sword size={32} className="text-red-300 dark:text-red-600" />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-700 dark:text-slate-200">Attack Mind Simulator</p>
                  <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    AI red-teams your architecture, discovering realistic kill chains and attack paths an adversary could exploit.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Save bar */}
          {showSave && !streaming && (
            <div className={`shrink-0 border-t px-4 py-3 flex flex-col gap-2 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Save this simulation</p>
              <div className="flex gap-2">
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Simulation name…"
                  className={`flex-1 min-w-0 rounded-lg border px-3 py-1.5 text-sm ${isDark ? 'border-slate-600 bg-slate-700 text-slate-100 placeholder:text-slate-500' : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400'}`}
                />
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 shrink-0"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Step timeline — shown when animating a path */}
          {timelinePath && !streaming && (
            <TimelineBar
              path={timelinePath}
              stepIndex={timelineStepIndex}
              isPlaying={isPlaying}
              isDark={isDark}
              onPrev={handleTimelinePrev}
              onNext={handleTimelineNext}
              onPlay={handleTimelinePlay}
              onReset={handleTimelineReset}
            />
          )}

          {Footer}
        </>
      )}

      {/* ── History Tab ── */}
      {activeTab === 'history' && (
        <div className="flex-1 overflow-y-auto">
          {loadingHistory ? (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-slate-400" />
            </div>
          ) : (
            <SavedSimulationsList
              simulations={simulations}
              onLoad={handleLoadSim}
              onDelete={handleDeleteSim}
            />
          )}
        </div>
      )}
    </div>
  );
}
