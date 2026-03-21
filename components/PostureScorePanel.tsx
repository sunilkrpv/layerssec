'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck, X, RefreshCw, Loader2, ChevronDown, ChevronRight,
  TrendingUp, AlertCircle, CheckCircle, Zap, History, Layers,
  Play, Clock,
} from 'lucide-react';
import {
  type PostureScoreResult,
  type PostureScoreHistoryItem,
  type PostureScoreDimension,
  type LayerPostureScore,
  apiComputePostureScore,
  apiGetPostureScoreHistory,
} from '@/lib/api';
import { useTheme } from '@/lib/themeContext';

// ── Helpers ────────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  return score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
}
function scoreLabel(score: number) {
  return score >= 80 ? 'Good' : score >= 60 ? 'Fair' : score >= 40 ? 'Poor' : 'Critical';
}
function scoreBgClass(score: number) {
  return score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-400' : score >= 40 ? 'bg-orange-500' : 'bg-red-500';
}
function scoreTextClass(score: number) {
  return score >= 80
    ? 'text-green-600 dark:text-green-400'
    : score >= 60
      ? 'text-amber-500 dark:text-amber-400'
      : score >= 40
        ? 'text-orange-500 dark:text-orange-400'
        : 'text-red-500 dark:text-red-400';
}

// ── SVG Circular Gauge ────────────────────────────────────────────────────────

function CircularGauge({ score, size = 140 }: { score: number; size?: number }) {
  const r = size * 0.41;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = scoreColor(score);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={size * 0.078} className="dark:stroke-slate-700" />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke={color} strokeWidth={size * 0.078}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x={cx} y={cy - size * 0.047} textAnchor="middle" fontSize={size * 0.22} fontWeight="700" fill={color}>{score}</text>
        <text x={cx} y={cy + size * 0.12} textAnchor="middle" fontSize={size * 0.095} fill="#94a3b8">/100</text>
      </svg>
      <span className="text-sm font-bold" style={{ color }}>{scoreLabel(score)}</span>
    </div>
  );
}

// ── Dimension Bar ─────────────────────────────────────────────────────────────

function DimensionBar({ dim }: { dim: PostureScoreDimension }) {
  const pct = Math.round((dim.score / dim.maxScore) * 100);
  const color = scoreBgClass(pct);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-xs text-slate-600 dark:text-slate-300 truncate">{dim.name}</span>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0 ml-2">{dim.score}/{dim.maxScore}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Layer Score Row ───────────────────────────────────────────────────────────

function LayerScoreRow({
  ls,
  isActive,
  onClick,
  expanded,
}: {
  ls: LayerPostureScore;
  isActive: boolean;
  onClick: () => void;
  expanded: boolean;
}) {
  const color = scoreColor(ls.score);
  const bgBar = scoreBgClass(ls.score);

  return (
    <div className={`rounded-lg border transition-colors ${isActive ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10' : 'border-slate-200 dark:border-slate-700'}`}>
      <button onClick={onClick} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left">
        {expanded
          ? <ChevronDown size={14} className="shrink-0 text-slate-400" />
          : <ChevronRight size={14} className="shrink-0 text-slate-400" />}
        <Layers size={13} className={isActive ? 'text-indigo-500 shrink-0' : 'text-slate-400 shrink-0'} />
        <span className={`flex-1 text-sm font-medium truncate ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>
          {ls.layerName}
          {isActive && <span className="ml-1.5 text-xs text-indigo-400">(current)</span>}
        </span>
        <span className="text-base font-bold shrink-0" style={{ color }}>{ls.score}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 flex flex-col gap-2">
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
            <div className={`h-2 rounded-full ${bgBar}`} style={{ width: `${ls.score}%` }} />
          </div>
          {ls.dimensions.map((dim) => (
            <DimensionBar key={dim.name} dim={dim} />
          ))}
          {ls.deductions.length > 0 && (
            <div className="mt-1 flex flex-col gap-1">
              {ls.deductions.map((d, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <AlertCircle size={12} className="mt-0.5 shrink-0 text-red-400" />
                  <span className="flex-1 text-slate-500 dark:text-slate-400 leading-relaxed">{d.reason}</span>
                  <span className="font-semibold text-red-500 shrink-0">-{d.points}</span>
                </div>
              ))}
            </div>
          )}
          {ls.additions.length > 0 && (
            <div className="flex flex-col gap-1">
              {ls.additions.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <CheckCircle size={12} className="mt-0.5 shrink-0 text-green-400" />
                  <span className="flex-1 text-slate-500 dark:text-slate-400 leading-relaxed">{a.reason}</span>
                  <span className="font-semibold text-green-500 shrink-0">+{a.points}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── History Sparkline ─────────────────────────────────────────────────────────

function HistorySparkline({ history }: { history: PostureScoreHistoryItem[] }) {
  if (history.length < 2) return null;
  const scores = history.map((h) => h.score).reverse();
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const w = 200;
  const h = 44;
  const pts = scores.map((s, i) => `${(i / (scores.length - 1)) * w},${h - ((s - min) / range) * (h - 8) - 4}`).join(' ');
  return (
    <svg width={w} height={h} className="mt-1">
      <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {scores.map((s, i) => (
        <circle key={i} cx={(i / (scores.length - 1)) * w} cy={h - ((s - min) / range) * (h - 8) - 4} r={4} fill="#6366f1">
          <title>v{history[history.length - 1 - i]?.diagramVersion}: {s}</title>
        </circle>
      ))}
    </svg>
  );
}

// ── History Entry Row ─────────────────────────────────────────────────────────

function HistoryRow({
  h,
  onLoad,
}: {
  h: PostureScoreHistoryItem;
  onLoad: (h: PostureScoreHistoryItem) => void;
}) {
  const color = scoreColor(h.score);
  const layerCount = h.layerScores ? Object.keys(h.layerScores).length : 0;

  return (
    <button
      onClick={() => onLoad(h)}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
    >
      {/* Score badge */}
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: color }}>
        <span className="text-sm font-bold" style={{ color }}>{h.score}</span>
      </div>
      {/* Meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-semibold ${scoreTextClass(h.score)}`}>{scoreLabel(h.score)}</span>
          {layerCount > 0 && (
            <span className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-xs text-slate-500 dark:text-slate-400">
              {layerCount} layers
            </span>
          )}
          {h.useExtended && (
            <span title="Extended thinking" className="rounded bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 text-xs text-purple-600 dark:text-purple-300 flex items-center gap-0.5">
              <Zap size={10} /> Extended
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock size={11} className="text-slate-400" />
          <span className="text-xs text-slate-400">{new Date(h.analyzedAt).toLocaleString()}</span>
          <span className="text-xs text-slate-400">· v{h.diagramVersion}</span>
        </div>
      </div>
      <ChevronRight size={14} className="shrink-0 text-slate-400" />
    </button>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

interface PostureScorePanelProps {
  projectId: string;
  diagramId: string;
  diagramVersion: number;
  layers: Record<string, unknown>;
  /** The layer the user is currently viewing — used to highlight in per-layer breakdown */
  currentLayerId: string;
  onClose: () => void;
  onScoreComputed?: (score: number) => void;
}

type Tab = 'analysis' | 'history';

export default function PostureScorePanel({
  projectId,
  diagramId,
  diagramVersion,
  layers,
  currentLayerId,
  onClose,
  onScoreComputed,
}: PostureScorePanelProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [result, setResult] = useState<PostureScoreResult | null>(null);
  const [history, setHistory] = useState<PostureScoreHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('analysis');
  const [useExtended, setUseExtended] = useState(false);
  const [expandedLayerId, setExpandedLayerId] = useState<string | null>(currentLayerId);
  // When a historical result is loaded we mark it so the UI can show a banner
  const [isHistoricalResult, setIsHistoricalResult] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try { setHistory(await apiGetPostureScoreHistory(projectId)); }
    catch { /* non-fatal */ }
    finally { setLoadingHistory(false); }
  }, [projectId]);

  // Load history once on mount (never auto-compute)
  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Auto-expand current layer when result changes
  useEffect(() => { setExpandedLayerId(currentLayerId); }, [currentLayerId, result]);

  const handleCompute = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsHistoricalResult(false);
    try {
      const r = await apiComputePostureScore({ projectId, diagramId, diagramVersion, layers, useExtendedThinking: useExtended });
      setResult(r);
      onScoreComputed?.(r.score);
      loadHistory();
      setActiveTab('analysis');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to compute score');
    } finally {
      setLoading(false);
    }
  }, [projectId, diagramId, diagramVersion, layers, useExtended, onScoreComputed, loadHistory]);

  const handleLoadHistorical = useCallback((h: PostureScoreHistoryItem) => {
    setResult(h as unknown as PostureScoreResult);
    setIsHistoricalResult(true);
    setActiveTab('analysis');
  }, []);

  // Normalize dimensions defensively (handles legacy records with object format)
  function normalizeDims(dims: unknown): PostureScoreDimension[] {
    if (Array.isArray(dims)) return dims as PostureScoreDimension[];
    if (dims && typeof dims === 'object') {
      return Object.entries(dims as Record<string, number>).map(([name, score]) => ({ name, score, maxScore: 20 }));
    }
    return [];
  }

  const currentLayerScore: LayerPostureScore | null = result?.layerScores?.[currentLayerId] ?? null;
  const layerScoreEntries = result?.layerScores
    ? Object.values(result.layerScores).sort((a, b) => a.score - b.score)
    : [];

  // ── Shared footer ─────────────────────────────────────────────────────────
  const Footer = (
    <div className={`shrink-0 border-t px-4 py-3 flex flex-col gap-2.5 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
      <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 cursor-pointer select-none">
        <input type="checkbox" checked={useExtended} onChange={(e) => setUseExtended(e.target.checked)} className="rounded accent-purple-500" />
        <Zap size={13} className="text-purple-500" />
        Use extended thinking
      </label>
      <button
        onClick={handleCompute}
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
        {loading ? 'Analyzing all layers…' : result ? 'Re-run Analysis' : 'Run Analysis'}
      </button>
    </div>
  );

  return (
    <div
      className={`flex h-full flex-col border-l ${isDark ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'}`}
      style={{ width: 460 }}
    >
      {/* ── Header ── */}
      <div className={`flex h-10 shrink-0 items-center gap-2.5 border-b px-4 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
        <ShieldCheck size={15} className="text-indigo-500" />
        <span className="flex-1 text-sm font-semibold">Security Posture Score</span>
        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
          <X size={15} />
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className={`flex shrink-0 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
        {(['analysis', 'history'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {tab === 'analysis' ? <ShieldCheck size={13} /> : <History size={13} />}
            {tab === 'analysis' ? 'Analysis' : `History${history.length > 0 ? ` (${history.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* ── Analysis Tab ── */}
      {activeTab === 'analysis' && (
        <>
          <div className="flex-1 overflow-y-auto">

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <Loader2 size={36} className="animate-spin text-indigo-500" />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    {useExtended ? 'Running extended analysis…' : 'Analyzing all layers…'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">This may take 15–30 seconds</p>
                </div>
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                <div className="flex items-start gap-3">
                  <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              </div>
            )}

            {/* Empty state — no result yet */}
            {!loading && !result && !error && (
              <div className="flex flex-col gap-5 p-4">
                {/* CTA card */}
                <div className={`rounded-xl border-2 border-dashed p-5 text-center ${isDark ? 'border-slate-600' : 'border-slate-300'}`}>
                  <ShieldCheck size={36} className="mx-auto mb-3 text-indigo-400" />
                  <p className="text-base font-semibold text-slate-700 dark:text-slate-200">Run a Posture Analysis</p>
                  <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    AI will score your architecture across 5 security dimensions — per layer and in aggregate.
                  </p>
                  <button
                    onClick={handleCompute}
                    className="mt-4 flex items-center gap-2 mx-auto rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                  >
                    <Play size={15} />
                    Run Analysis
                  </button>
                </div>

                {/* Recent scores teaser */}
                {history.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Recent Scores</p>
                    <div className="flex flex-col gap-1">
                      {history.slice(0, 3).map((h) => (
                        <HistoryRow key={h.id} h={h} onLoad={handleLoadHistorical} />
                      ))}
                    </div>
                    {history.length > 3 && (
                      <button
                        onClick={() => setActiveTab('history')}
                        className="mt-1 w-full text-center text-xs text-indigo-500 hover:text-indigo-600 py-1"
                      >
                        View all {history.length} analyses →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Result */}
            {!loading && result && (
              <div className="flex flex-col gap-5 p-4">

                {/* Historical banner */}
                {isHistoricalResult && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2">
                    <Clock size={13} className="text-amber-500 shrink-0" />
                    <span className="text-xs text-amber-700 dark:text-amber-300 flex-1">
                      Showing historical result from {new Date(result.analyzedAt).toLocaleString()} · v{result.diagramVersion}
                    </span>
                    <button onClick={handleCompute} className="text-xs text-indigo-500 hover:text-indigo-600 font-medium shrink-0">
                      Refresh
                    </button>
                  </div>
                )}

                {/* Aggregate gauge */}
                <div className="flex items-center gap-5">
                  <CircularGauge score={result.score} size={130} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                      {layerScoreEntries.length > 1 ? `${layerScoreEntries.length} layers analyzed` : 'Overall Score'}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{result.summary}</p>
                    {!isHistoricalResult && (
                      <p className="mt-2 text-xs text-slate-400">
                        {new Date(result.analyzedAt).toLocaleString()} · v{result.diagramVersion}
                        {result.useExtended && <span className="ml-1 inline-flex items-center gap-0.5 text-purple-500"><Zap size={10} /> Extended</span>}
                      </p>
                    )}
                  </div>
                </div>

                {/* Current layer callout */}
                {currentLayerScore && currentLayerScore.layerId !== 'root' && (
                  <div className={`rounded-xl border-2 p-4 ${
                    currentLayerScore.score >= 80 ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20' :
                    currentLayerScore.score >= 60 ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20' :
                    'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Layers size={13} className="text-indigo-500 shrink-0" />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{currentLayerScore.layerName}</span>
                      <span className="text-base font-bold ml-auto shrink-0" style={{ color: scoreColor(currentLayerScore.score) }}>
                        {currentLayerScore.score}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                      <div className={`h-2 rounded-full ${scoreBgClass(currentLayerScore.score)}`} style={{ width: `${currentLayerScore.score}%` }} />
                    </div>
                    <div className="mt-3 flex flex-col gap-1.5">
                      {normalizeDims(currentLayerScore.dimensions).map((dim) => (
                        <DimensionBar key={dim.name} dim={dim} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Per-layer breakdown */}
                {layerScoreEntries.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">All Layers</p>
                    <div className="flex flex-col gap-2">
                      {layerScoreEntries.map((ls) => (
                        <LayerScoreRow
                          key={ls.layerId}
                          ls={{ ...ls, dimensions: normalizeDims(ls.dimensions) }}
                          isActive={ls.layerId === currentLayerId}
                          expanded={expandedLayerId === ls.layerId}
                          onClick={() => setExpandedLayerId(expandedLayerId === ls.layerId ? null : ls.layerId)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Aggregate dimensions (single-layer diagrams) */}
                {(!result.layerScores || currentLayerScore?.layerId === 'root') && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Dimensions</p>
                    <div className="flex flex-col gap-2">
                      {normalizeDims(result.dimensions).map((dim) => (
                        <DimensionBar key={dim.name} dim={dim} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Deductions */}
                {Array.isArray(result.deductions) && result.deductions.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Top Deductions</p>
                    <div className="flex flex-col gap-1.5">
                      {result.deductions.map((d, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <AlertCircle size={13} className="mt-0.5 shrink-0 text-red-400" />
                          <span className="flex-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{d.reason}</span>
                          <span className="text-sm font-semibold text-red-500 shrink-0">-{d.points}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strengths */}
                {Array.isArray(result.additions) && result.additions.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Strengths</p>
                    <div className="flex flex-col gap-1.5">
                      {result.additions.map((a, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <CheckCircle size={13} className="mt-0.5 shrink-0 text-green-400" />
                          <span className="flex-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{a.reason}</span>
                          <span className="text-sm font-semibold text-green-500 shrink-0">+{a.points}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Recommendations */}
                {Array.isArray(result.topRecs) && result.topRecs.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Top Recommendations</p>
                    <ol className="flex flex-col gap-2">
                      {(result.topRecs as string[]).map((rec, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 font-semibold text-xs">{i + 1}</span>
                          <span className="leading-relaxed">{rec}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>
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
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
              <TrendingUp size={32} className="text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500">No analyses yet. Run your first posture analysis to see results here.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Sparkline trend */}
              {history.length >= 2 && (
                <div className="px-4 pt-4 pb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Score Trend</p>
                  <HistorySparkline history={history} />
                </div>
              )}

              {/* Divider */}
              <div className={`my-1 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`} />

              {/* List */}
              <div className="flex flex-col py-1">
                {history.map((h) => (
                  <HistoryRow key={h.id} h={h} onLoad={handleLoadHistorical} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
