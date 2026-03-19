'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck, X, RefreshCw, Loader2, ChevronDown, ChevronRight,
  TrendingUp, AlertCircle, CheckCircle, Zap, History, Layers,
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
  return score >= 80 ? 'text-green-600 dark:text-green-400' : score >= 60 ? 'text-amber-500 dark:text-amber-400' : score >= 40 ? 'text-orange-500 dark:text-orange-400' : 'text-red-500 dark:text-red-400';
}

// ── SVG Circular Gauge ────────────────────────────────────────────────────────

function CircularGauge({ score, size = 128 }: { score: number; size?: number }) {
  const r = size * 0.41;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = scoreColor(score);

  return (
    <div className="flex flex-col items-center gap-1">
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
        <text x={cx} y={cy - size * 0.047} textAnchor="middle" fontSize={size * 0.203} fontWeight="700" fill={color}>{score}</text>
        <text x={cx} y={cy + size * 0.109} textAnchor="middle" fontSize={size * 0.086} fill="#94a3b8">/100</text>
      </svg>
      <span className="text-xs font-semibold" style={{ color }}>{scoreLabel(score)}</span>
    </div>
  );
}

// ── Dimension Bar ─────────────────────────────────────────────────────────────

function DimensionBar({ dim }: { dim: PostureScoreDimension }) {
  const pct = Math.round((dim.score / dim.maxScore) * 100);
  const color = scoreBgClass(pct);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate">{dim.name}</span>
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 ml-1">{dim.score}/{dim.maxScore}</span>
      </div>
      <div className="mx-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
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
      <button onClick={onClick} className="flex w-full items-center gap-2 px-2.5 py-2 text-left">
        {expanded
          ? <ChevronDown size={12} className="shrink-0 text-slate-400" />
          : <ChevronRight size={12} className="shrink-0 text-slate-400" />}
        <Layers size={11} className={isActive ? 'text-indigo-500 shrink-0' : 'text-slate-400 shrink-0'} />
        <span className={`flex-1 text-xs font-medium truncate ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>
          {ls.layerName}
          {isActive && <span className="ml-1 text-[10px] text-indigo-400">(current)</span>}
        </span>
        <span className="text-sm font-bold shrink-0" style={{ color }}>{ls.score}</span>
      </button>

      {/* Mini dimension bars when expanded */}
      {expanded && (
        <div className="px-3 pb-2.5 flex flex-col gap-1.5">
          <div className="mb-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
            <div className={`h-1.5 rounded-full ${bgBar}`} style={{ width: `${ls.score}%` }} />
          </div>
          {ls.dimensions.map((dim) => (
            <DimensionBar key={dim.name} dim={dim} />
          ))}
          {ls.deductions.length > 0 && (
            <div className="mt-1 flex flex-col gap-0.5">
              {ls.deductions.map((d, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px]">
                  <AlertCircle size={10} className="mt-0.5 shrink-0 text-red-400" />
                  <span className="flex-1 text-slate-500 dark:text-slate-400">{d.reason}</span>
                  <span className="font-semibold text-red-500 shrink-0">-{d.points}</span>
                </div>
              ))}
            </div>
          )}
          {ls.additions.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {ls.additions.map((a, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px]">
                  <CheckCircle size={10} className="mt-0.5 shrink-0 text-green-400" />
                  <span className="flex-1 text-slate-500 dark:text-slate-400">{a.reason}</span>
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
  const w = 160;
  const h = 36;
  const pts = scores.map((s, i) => `${(i / (scores.length - 1)) * w},${h - ((s - min) / range) * (h - 6) - 3}`).join(' ');
  return (
    <svg width={w} height={h} className="mt-1">
      <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {scores.map((s, i) => (
        <circle key={i} cx={(i / (scores.length - 1)) * w} cy={h - ((s - min) / range) * (h - 6) - 3} r={3} fill="#6366f1">
          <title>v{history[history.length - 1 - i]?.diagramVersion}: {s}</title>
        </circle>
      ))}
    </svg>
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
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [useExtended, setUseExtended] = useState(false);
  const [expandedLayerId, setExpandedLayerId] = useState<string | null>(currentLayerId);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try { setHistory(await apiGetPostureScoreHistory(projectId)); }
    catch { /* non-fatal */ }
    finally { setLoadingHistory(false); }
  }, [projectId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Auto-expand current layer when result changes
  useEffect(() => { setExpandedLayerId(currentLayerId); }, [currentLayerId, result]);

  const handleCompute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiComputePostureScore({ projectId, diagramId, diagramVersion, layers, useExtendedThinking: useExtended });
      setResult(r);
      onScoreComputed?.(r.score);
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to compute score');
    } finally {
      setLoading(false);
    }
  }, [projectId, diagramId, diagramVersion, layers, useExtended, onScoreComputed, loadHistory]);

  useEffect(() => {
    if (!result && !loading) handleCompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive the current layer's individual score (if available)
  const currentLayerScore: LayerPostureScore | null =
    result?.layerScores?.[currentLayerId] ?? null;

  // Normalize dimensions defensively (handles legacy records with object format)
  function normalizeDims(dims: unknown): PostureScoreDimension[] {
    if (Array.isArray(dims)) return dims as PostureScoreDimension[];
    if (dims && typeof dims === 'object') {
      return Object.entries(dims as Record<string, number>).map(([name, score]) => ({ name, score, maxScore: 20 }));
    }
    return [];
  }

  const layerScoreEntries = result?.layerScores
    ? Object.values(result.layerScores).sort((a, b) => a.score - b.score) // worst first
    : [];

  return (
    <div className={`flex h-full flex-col border-l ${isDark ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'}`} style={{ width: 320 }}>
      {/* Header */}
      <div className={`flex h-9 shrink-0 items-center gap-2 border-b px-3 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
        <ShieldCheck size={14} className="text-indigo-500" />
        <span className="flex-1 text-sm font-semibold">Security Posture Score</span>
        <button onClick={() => setShowHistory((v) => !v)} title="Score history"
          className={`rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700 ${showHistory ? 'text-indigo-500' : 'text-slate-400'}`}>
          <History size={14} />
        </button>
        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
          <X size={14} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── History view ── */}
        {showHistory && (
          <div className="border-b border-slate-200 dark:border-slate-700 p-3">
            <div className="flex items-center gap-1 mb-2">
              <TrendingUp size={12} className="text-indigo-500" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Score Trend (aggregate)</span>
            </div>
            {loadingHistory ? (
              <Loader2 size={14} className="animate-spin text-slate-400 mx-auto" />
            ) : history.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No history yet</p>
            ) : (
              <>
                <HistorySparkline history={history} />
                <div className="mt-2 flex flex-col gap-1 max-h-40 overflow-y-auto">
                  {history.map((h) => (
                    <div key={h.id}
                      className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer"
                      onClick={() => { setResult(h as unknown as PostureScoreResult); setShowHistory(false); }}
                    >
                      <span className={`font-bold w-8 text-right ${scoreTextClass(h.score)}`}>{h.score}</span>
                      <span className="text-slate-500 dark:text-slate-400 flex-1">
                        v{h.diagramVersion}
                        {h.layerScores && <span className="ml-1 text-slate-400">· {Object.keys(h.layerScores).length} layers</span>}
                      </span>
                      <span className="text-slate-400">{new Date(h.analyzedAt).toLocaleDateString()}</span>
                      {h.useExtended && <span title="Extended thinking"><Zap size={10} className="text-purple-500" /></span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <Loader2 size={28} className="animate-spin text-indigo-500" />
            <p className="text-xs text-slate-500">{useExtended ? 'Extended analysis…' : 'Analyzing all layers…'}</p>
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="m-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {!loading && result && (
          <div className="flex flex-col gap-4 p-3">

            {/* ── Aggregate gauge + summary ── */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {layerScoreEntries.length > 1 ? `Aggregate — ${layerScoreEntries.length} layers` : 'Overall Score'}
              </p>
              <div className="flex items-center gap-3">
                <CircularGauge score={result.score} size={100} />
                <p className="flex-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{result.summary}</p>
              </div>
            </div>

            {/* ── Current layer callout (if per-layer data exists and we're not at root) ── */}
            {currentLayerScore && currentLayerScore.layerId !== 'root' && (
              <div className={`rounded-lg border-2 p-2.5 ${
                currentLayerScore.score >= 80 ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20' :
                currentLayerScore.score >= 60 ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20' :
                'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
              }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Layers size={11} className="text-indigo-500 shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">{currentLayerScore.layerName}</span>
                  <span className="text-sm font-bold ml-auto shrink-0" style={{ color: scoreColor(currentLayerScore.score) }}>
                    {currentLayerScore.score}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className={`h-1.5 rounded-full ${scoreBgClass(currentLayerScore.score)}`} style={{ width: `${currentLayerScore.score}%` }} />
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  {normalizeDims(currentLayerScore.dimensions).map((dim) => (
                    <DimensionBar key={dim.name} dim={dim} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Per-layer breakdown ── */}
            {layerScoreEntries.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">All Layers</p>
                <div className="flex flex-col gap-1.5">
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

            {/* ── Aggregate dimensions (when no per-layer data or on root) ── */}
            {(!result.layerScores || currentLayerScore?.layerId === 'root') && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Dimensions</p>
                <div className="flex flex-col gap-1.5">
                  {normalizeDims(result.dimensions).map((dim) => (
                    <DimensionBar key={dim.name} dim={dim} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Aggregate deductions ── */}
            {Array.isArray(result.deductions) && result.deductions.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Top Deductions</p>
                <div className="flex flex-col gap-1">
                  {result.deductions.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <AlertCircle size={11} className="mt-0.5 shrink-0 text-red-400" />
                      <span className="flex-1 text-slate-600 dark:text-slate-300">{d.reason}</span>
                      <span className="font-semibold text-red-500 shrink-0">-{d.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Aggregate strengths ── */}
            {Array.isArray(result.additions) && result.additions.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Strengths</p>
                <div className="flex flex-col gap-1">
                  {result.additions.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <CheckCircle size={11} className="mt-0.5 shrink-0 text-green-400" />
                      <span className="flex-1 text-slate-600 dark:text-slate-300">{a.reason}</span>
                      <span className="font-semibold text-green-500 shrink-0">+{a.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Top Recommendations ── */}
            {Array.isArray(result.topRecs) && result.topRecs.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Top Recommendations</p>
                <ol className="flex flex-col gap-1.5">
                  {(result.topRecs as string[]).map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 font-semibold text-[10px]">{i + 1}</span>
                      {rec}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <p className="text-[10px] text-slate-400 italic">
              Analyzed {new Date(result.analyzedAt).toLocaleString()} · v{result.diagramVersion}
              {result.useExtended && <><span title="Extended thinking"><Zap size={9} className="inline ml-1 text-purple-500" /></span> Extended</>}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`shrink-0 border-t px-3 py-2 flex flex-col gap-2 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
          <input type="checkbox" checked={useExtended} onChange={(e) => setUseExtended(e.target.checked)} className="rounded accent-purple-500" />
          <Zap size={11} className="text-purple-500" />
          Use extended thinking
        </label>
        <button
          onClick={handleCompute}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {loading ? 'Analyzing…' : result ? 'Recalculate All Layers' : 'Calculate Score'}
        </button>
      </div>
    </div>
  );
}
