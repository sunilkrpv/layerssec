'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, Sword, BarChart3, AlertTriangle, Clock,
  ExternalLink, Layers, TrendingUp, TrendingDown, Minus, RefreshCw,
  Bot, Activity, FileDown, Loader2,
} from 'lucide-react';
import { apiGetProjectOverview, apiExportThreatReport, type ProjectOverview } from '@/lib/api';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number | null) {
  if (score === null) return { bar: 'bg-slate-300 dark:bg-slate-600', text: 'text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800' };
  if (score >= 75) return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' };
  if (score >= 50) return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' };
  return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40' };
}

function scoreLabel(score: number | null) {
  if (score === null) return 'Not computed';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Poor';
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const ACTIVITY_ICONS = {
  ai_generation: Bot,
  stride_analysis: Shield,
  posture_score: BarChart3,
  attack_simulation: Sword,
};

const ACTIVITY_COLORS = {
  ai_generation: 'text-violet-600 dark:text-violet-400',
  stride_analysis: 'text-blue-600 dark:text-blue-400',
  posture_score: 'text-emerald-600 dark:text-emerald-400',
  attack_simulation: 'text-red-600 dark:text-red-400',
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-slate-200 dark:bg-slate-700', className)} />;
}

// ── Hero Cards ────────────────────────────────────────────────────────────────

function PostureCard({ data, onDetails }: { data: ProjectOverview['postureScore']; onDetails: () => void }) {
  const sc = scoreColor(data.score);
  const delta = data.weekDelta;
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Security Posture</p>
          {data.score !== null ? (
            <p className={cn('mt-1 text-[36px] font-bold leading-none', sc.text)}>{data.score}</p>
          ) : (
            <p className="mt-1 text-[24px] font-semibold text-slate-400">—</p>
          )}
        </div>
        <div className={cn('rounded-lg p-2', sc.bg)}>
          <Shield size={20} className={sc.text} />
        </div>
      </div>

      {data.score !== null ? (
        <>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
            <div className={cn('h-2 rounded-full', sc.bar)} style={{ width: `${data.score}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className={cn('text-[13px] font-semibold', sc.text)}>{scoreLabel(data.score)}</span>
            {delta !== null && (
              <span className={cn('flex items-center gap-0.5 text-[12px] font-medium', delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400')}>
                {delta > 0 ? <TrendingUp size={12} /> : delta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                {delta > 0 ? '+' : ''}{delta} this week
              </span>
            )}
          </div>
          {data.layerCount > 0 && (
            <p className="mt-1 text-[12px] text-slate-400">{data.layerCount} layer{data.layerCount !== 1 ? 's' : ''} analyzed</p>
          )}
        </>
      ) : (
        <p className="mt-3 text-[13px] text-slate-400">No analysis run yet</p>
      )}

      <button
        onClick={onDetails}
        className="mt-4 self-start text-[13px] font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        {data.score !== null ? 'View details →' : 'Run analysis →'}
      </button>
    </div>
  );
}

function ThreatCard({ data, onDashboard, onRunStride }: { data: ProjectOverview['threats']; onDashboard: () => void; onRunStride: () => void }) {
  const STRIDE_LABELS = ['S', 'T', 'R', 'I', 'D', 'E'];
  const STRIDE_COLORS = ['bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-blue-400', 'bg-purple-400', 'bg-rose-400'];

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Threat Surface</p>
          <p className="mt-1 text-[36px] font-bold leading-none text-slate-800 dark:text-slate-100">{data.total}</p>
        </div>
        <div className="rounded-lg bg-orange-50 p-2 dark:bg-orange-950/40">
          <AlertTriangle size={20} className="text-orange-600 dark:text-orange-400" />
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {[
          { label: 'Critical', count: data.bySeverity.critical, color: 'bg-red-500' },
          { label: 'High', count: data.bySeverity.high, color: 'bg-orange-500' },
          { label: 'Medium', count: data.bySeverity.medium, color: 'bg-amber-500' },
          { label: 'Low', count: data.bySeverity.low, color: 'bg-blue-400' },
        ].filter((s) => s.count > 0).map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className={cn('h-1.5 w-1.5 rounded-full', s.color)} />
            <span className="text-[12px] text-slate-600 dark:text-slate-400">{s.label}</span>
            <span className="ml-auto text-[12px] font-semibold text-slate-700 dark:text-slate-300">{s.count}</span>
          </div>
        ))}
        {data.total === 0 && <p className="text-[13px] text-slate-400">No threats found yet</p>}
      </div>

      {/* STRIDE distribution dots */}
      <div className="mt-3 flex items-center gap-1.5">
        {STRIDE_LABELS.map((label, i) => {
          const count = data.byStride[label as keyof typeof data.byStride];
          return (
            <div key={label} className="flex flex-col items-center gap-0.5" title={`${label}: ${count}`}>
              <div className={cn('h-1.5 w-1.5 rounded-full', count > 0 ? STRIDE_COLORS[i] : 'bg-slate-200 dark:bg-slate-700')} />
              <span className="text-[9px] font-bold text-slate-400">{label}</span>
            </div>
          );
        })}
      </div>

      <button
        onClick={data.total > 0 ? onDashboard : onRunStride}
        className="mt-4 self-start text-[13px] font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        {data.total > 0 ? 'View dashboard →' : 'Run STRIDE analysis'}
      </button>
    </div>
  );
}

function AttackCard({ data, onRun }: { data: ProjectOverview['attackSims']; onRun: () => void }) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Attack Intel</p>
          <p className="mt-1 text-[36px] font-bold leading-none text-slate-800 dark:text-slate-100">{data.total}</p>
        </div>
        <div className="rounded-lg bg-red-50 p-2 dark:bg-red-950/40">
          <Sword size={20} className="text-red-600 dark:text-red-400" />
        </div>
      </div>

      {data.total > 0 ? (
        <>
          {data.lastRunAt && (
            <p className="mt-2 flex items-center gap-1 text-[13px] text-slate-500 dark:text-slate-400">
              <Clock size={12} />
              Last run: {relativeTime(data.lastRunAt)}
            </p>
          )}
          {data.topPathSummary && (
            <p className="mt-1 truncate text-[13px] italic text-slate-500 dark:text-slate-400">
              "{data.topPathSummary}"
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-[13px] text-slate-400">No simulations run yet</p>
      )}

      <button onClick={onRun} className="mt-4 self-start text-[13px] font-medium text-red-600 hover:underline dark:text-red-400">
        {data.total > 0 ? 'Run new simulation →' : 'Simulate attack →'}
      </button>
    </div>
  );
}

// ── Layer breakdown table ─────────────────────────────────────────────────────

function LayerRow({ layer, onOpen }: { layer: ProjectOverview['layers'][0]; onOpen: (layerId: string) => void }) {
  const sc = scoreColor(layer.postureScore);
  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14px] font-medium text-slate-800 dark:text-slate-100">{layer.layerName}</span>
        <span className="text-[12px] text-slate-500 dark:text-slate-400">{layer.nodeCount} nodes</span>
      </div>
      {/* Posture score bar */}
      <div className="flex w-28 items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700">
          <div className={cn('h-1.5 rounded-full', sc.bar)} style={{ width: `${layer.postureScore ?? 0}%` }} />
        </div>
        <span className={cn('w-7 text-right text-[12px] font-semibold tabular-nums', sc.text)}>
          {layer.postureScore ?? '—'}
        </span>
      </div>
      {/* Threat count */}
      <div className="flex w-16 items-center justify-center">
        {layer.threatCount > 0 ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-400">
            {layer.threatCount}
          </span>
        ) : (
          <span className="text-[12px] text-slate-300 dark:text-slate-600">—</span>
        )}
      </div>
      <button
        onClick={() => onOpen(layer.layerId)}
        className="flex-shrink-0 rounded-md border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Open
      </button>
    </div>
  );
}

// ── Recent Activity ───────────────────────────────────────────────────────────

function ActivityItem({ item }: { item: ProjectOverview['recentActivity'][0] }) {
  const Icon = ACTIVITY_ICONS[item.type] ?? Activity;
  const color = ACTIVITY_COLORS[item.type] ?? 'text-slate-400';
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="mt-0.5 flex-shrink-0">
        <Icon size={15} className={color} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] text-slate-700 dark:text-slate-200">{item.description}</p>
      </div>
      <span className="flex-shrink-0 text-[12px] text-slate-400">{relativeTime(item.occurredAt)}</span>
    </div>
  );
}

// ── ProjectCommandCenter ──────────────────────────────────────────────────────

export default function ProjectCommandCenter({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [overview, setOverview] = useState<ProjectOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingReport, setExportingReport] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiGetProjectOverview(projectId);
      setOverview(data);
    } catch (e) {
      setError('Failed to load project overview');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    setOverview(null);
    load();
  }, [projectId, load]);

  const openDiagram = (layerId?: string, action?: string) => {
    const params = new URLSearchParams();
    if (layerId) params.set('currLayer', layerId);
    if (action) params.set('action', action);
    const qs = params.toString();
    router.push(`/projects/${projectId}${qs ? `?${qs}` : ''}`);
  };
  const openThreats = () => router.push(`/projects/${projectId}/threats`);
  const handleExportReport = async () => {
    setExportingReport(true);
    try { await apiExportThreatReport(projectId); }
    catch { /* error shown by browser */ }
    finally { setExportingReport(false); }
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
        <div className="flex h-14 flex-shrink-0 items-center border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
          <Skeleton className="h-6 w-48" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={32} className="mx-auto mb-3 text-amber-500" />
          <p className="text-[15px] text-slate-600 dark:text-slate-300">{error ?? 'No data available'}</p>
          <button onClick={load} className="mt-3 flex items-center gap-1.5 mx-auto text-[13px] text-blue-600 hover:underline dark:text-blue-400">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="mr-auto text-[20px] font-bold text-slate-900 dark:text-slate-100">{overview.project.name}</h1>
        {overview.project.status === 'published' && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
            Published
          </span>
        )}
        {overview.threats.total > 0 && (
          <button
            onClick={handleExportReport}
            disabled={exportingReport}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {exportingReport ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
            Export Report
          </button>
        )}
        <button
          onClick={openThreats}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Threats Dashboard
        </button>
        <button
          onClick={() => openDiagram()}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-blue-700"
        >
          Open Diagram <ExternalLink size={12} />
        </button>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

        {/* Hero cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <PostureCard data={overview.postureScore} onDetails={() => openDiagram(undefined, 'posture')} />
          <ThreatCard data={overview.threats} onDashboard={openThreats} onRunStride={() => openDiagram(undefined, 'stride')} />
          <AttackCard data={overview.attackSims} onRun={() => openDiagram(undefined, 'attack')} />
        </div>

        {/* Layer breakdown */}
        {overview.layers.length > 0 && (
          <section>
            <h2 className="mb-2 text-[15px] font-semibold text-slate-700 dark:text-slate-200">
              Layers ({overview.layers.length})
            </h2>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
              <div className="grid grid-cols-[1fr_140px_80px_80px] px-4 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Layer</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Posture</span>
                <span className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">Threats</span>
                <span />
              </div>
              {overview.layers.map((layer) => (
                <LayerRow key={layer.layerId} layer={layer} onOpen={openDiagram} />
              ))}
            </div>
          </section>
        )}

        {/* Recent activity */}
        {overview.recentActivity.length > 0 && (
          <section>
            <h2 className="mb-2 text-[15px] font-semibold text-slate-700 dark:text-slate-200">Recent Activity</h2>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4 dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
              {overview.recentActivity.map((item, i) => (
                <ActivityItem key={i} item={item} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {overview.layers.length === 0 && overview.recentActivity.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Layers size={40} className="mb-4 text-slate-300 dark:text-slate-600" />
            <p className="text-[16px] font-medium text-slate-600 dark:text-slate-300">No diagram yet</p>
            <p className="mt-1 text-[14px] text-slate-400">Open the diagram to start building your architecture</p>
            <button
              onClick={() => openDiagram()}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-blue-700"
            >
              Open Diagram →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
