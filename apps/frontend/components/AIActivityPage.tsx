'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity, Shield, Sword, BarChart2, Wand2, X, RotateCcw,
  Search, Settings, LogOut, ExternalLink,
  CheckCircle2, XCircle, Clock, Loader2, Filter,
  FolderOpen, Home, ChevronDown, ChevronRight,
  Zap, Brain,
} from 'lucide-react';
import LayersLogo from '@/components/LayersLogo';
import {
  apiListActivity, apiCancelJob,
  type AiJobListItem, type AiJobType, type AiJobStatus, type AiActivityFilters,
} from '@/lib/api';
import { isLoggedIn, getStoredUser, signOut } from '@/lib/authStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const JOB_TYPE_META: Record<AiJobType, { label: string; icon: React.ReactNode; color: string; dot: string }> = {
  THREAT_ANALYSIS: {
    label: 'Threat Analysis',
    icon: <Shield size={13} />,
    color: 'text-red-500 dark:text-red-400',
    dot: 'bg-red-500',
  },
  POSTURE_SCORE: {
    label: 'Posture Score',
    icon: <BarChart2 size={13} />,
    color: 'text-blue-500 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  ATTACK_SIMULATION: {
    label: 'Attack Simulation',
    icon: <Sword size={13} />,
    color: 'text-orange-500 dark:text-orange-400',
    dot: 'bg-orange-500',
  },
  DECLUTTER: {
    label: 'Declutter',
    icon: <Wand2 size={13} />,
    color: 'text-purple-500 dark:text-purple-400',
    dot: 'bg-purple-500',
  },
};

const STATUS_META: Record<AiJobStatus, { label: string; cls: string }> = {
  COMPLETED: { label: 'Completed', cls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' },
  FAILED:    { label: 'Failed',    cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' },
  RUNNING:   { label: 'Running',   cls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' },
  PENDING:   { label: 'Pending',   cls: 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-100 dark:bg-slate-700/40 text-slate-500 dark:text-slate-500' },
};

const DATE_RANGES = ['1h', '1d', '7d', '30d'] as const;
type DateRange = typeof DATE_RANGES[number];

const ALL_TYPES: AiJobType[] = ['THREAT_ANALYSIS', 'POSTURE_SCORE', 'ATTACK_SIMULATION', 'DECLUTTER'];
const ALL_STATUSES: AiJobStatus[] = ['COMPLETED', 'FAILED', 'RUNNING', 'PENDING', 'CANCELLED'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDuration(job: AiJobListItem): string {
  if (!job.startedAt) return '—';
  const end = job.completedAt ? new Date(job.completedAt) : new Date();
  const ms = end.getTime() - new Date(job.startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function shortId(id: string): string {
  return id.slice(0, 8) + '…';
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

interface SidebarProps {
  activeType: AiJobType | null;
  onTypeFilter: (t: AiJobType | null) => void;
  typeCounts: Record<string, number>;
  user: { email: string } | null;
  onSignOut: () => void;
}

function Sidebar({ activeType, onTypeFilter, typeCounts, user, onSignOut }: SidebarProps) {
  const router = useRouter();
  const [projectsOpen, setProjectsOpen] = useState(true);
  const total = Object.values(typeCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex h-full w-[220px] shrink-0 flex-col border-r border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
      {/* Logo */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
        <LayersLogo size={16} className="text-blue-600 dark:text-blue-500" />
        <span className="text-sm font-bold text-slate-900 dark:text-white">Layers</span>
        <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">Observability</span>
      </div>

      <div className="flex-1 overflow-y-auto py-3">

        {/* Observability */}
        <div className="mb-4">
          <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-600">
            Observability
          </p>
          <NavItem icon={<Activity size={14} />} label="AI Traces" active={activeType === null} count={total} onClick={() => onTypeFilter(null)} />
          <NavItem icon={<BarChart2 size={14} />} label="Usage Summary" soon onClick={() => {}} />
          <NavItem icon={<Brain size={14} />} label="Sessions" soon onClick={() => {}} />
        </div>

        {/* AI Features */}
        <div className="mb-4">
          <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-600">
            AI Features
          </p>
          {ALL_TYPES.map((t) => {
            const meta = JOB_TYPE_META[t];
            return (
              <NavItem
                key={t}
                icon={<span className={meta.color}>{meta.icon}</span>}
                label={meta.label}
                active={activeType === t}
                count={typeCounts[t] ?? 0}
                onClick={() => onTypeFilter(activeType === t ? null : t)}
              />
            );
          })}
        </div>

        {/* Projects */}
        <div className="mb-4">
          <button
            className="mb-1 flex w-full items-center gap-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400"
            onClick={() => setProjectsOpen((v) => !v)}
          >
            {projectsOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            Projects
          </button>
          {projectsOpen && (
            <NavItem icon={<FolderOpen size={14} />} label="My Projects" onClick={() => router.push('/projects')} />
          )}
        </div>

        {/* Evaluation */}
        <div className="mb-4">
          <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-600">
            Evaluation
          </p>
          <NavItem icon={<CheckCircle2 size={14} />} label="Quality Scores" soon onClick={() => {}} />
          <NavItem icon={<Zap size={14} />} label="LLM-as-a-Judge" soon onClick={() => {}} />
        </div>
      </div>

      {/* Bottom */}
      <div className="shrink-0 space-y-1 border-t border-slate-200 p-3 dark:border-slate-800">
        <NavItem icon={<Home size={14} />} label="Home" onClick={() => router.push('/home')} />
        <NavItem icon={<Settings size={14} />} label="Settings" onClick={() => router.push('/projects')} />
        {user && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              {user.email[0]?.toUpperCase()}
            </div>
            <span className="flex-1 min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</span>
            <button
              onClick={onSignOut}
              title="Sign out"
              className="rounded p-1 text-slate-400 hover:text-red-500 transition dark:text-slate-600 dark:hover:text-red-400"
            >
              <LogOut size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NavItem({
  icon, label, active, count, soon, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  count?: number;
  soon?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={soon ? undefined : onClick}
      disabled={soon}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
        active
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          : soon
          ? 'cursor-default text-slate-300 dark:text-slate-700'
          : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
      }`}
    >
      <span className={active ? 'text-blue-600 dark:text-blue-400' : soon ? 'text-slate-300 dark:text-slate-700' : 'text-slate-400 dark:text-slate-500'}>
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {soon && (
        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] text-slate-400 dark:bg-slate-800 dark:text-slate-600">soon</span>
      )}
      {!soon && typeof count === 'number' && count > 0 && (
        <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-500">{count}</span>
      )}
    </button>
  );
}

// ── Stats Row ─────────────────────────────────────────────────────────────────

function StatsRow({ jobs }: { jobs: AiJobListItem[] }) {
  const total = jobs.length;
  const completed = jobs.filter((j) => j.status === 'COMPLETED').length;
  const failed = jobs.filter((j) => j.status === 'FAILED').length;
  const successRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '—';
  const durations = jobs
    .filter((j) => j.startedAt && j.completedAt)
    .map((j) => new Date(j.completedAt!).getTime() - new Date(j.startedAt!).getTime());
  const avgDuration =
    durations.length > 0
      ? `${(durations.reduce((a, b) => a + b, 0) / durations.length / 1000).toFixed(1)}s`
      : '—';

  const stats = [
    { label: 'Total Traces', value: String(total), icon: <Activity size={14} className="text-blue-500" /> },
    { label: 'Success Rate', value: `${successRate}%`, icon: <CheckCircle2 size={14} className="text-emerald-500" /> },
    { label: 'Failed', value: String(failed), icon: <XCircle size={14} className="text-red-500" /> },
    { label: 'Avg Duration', value: avgDuration, icon: <Clock size={14} className="text-amber-500" /> },
  ];

  return (
    <div className="flex gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
        >
          {s.icon}
          <div>
            <p className="text-xl font-bold leading-none text-slate-900 dark:text-white">{s.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Filter Panel ──────────────────────────────────────────────────────────────

interface FilterPanelProps {
  selectedTypes: AiJobType[];
  selectedStatuses: AiJobStatus[];
  dateRange: DateRange | 'all';
  onTypesChange: (t: AiJobType[]) => void;
  onStatusesChange: (s: AiJobStatus[]) => void;
  onDateRangeChange: (r: DateRange | 'all') => void;
  typeCounts: Record<string, number>;
  statusCounts: Record<string, number>;
}

function FilterPanel({
  selectedTypes, selectedStatuses, dateRange,
  onTypesChange, onStatusesChange, onDateRangeChange,
  typeCounts, statusCounts,
}: FilterPanelProps) {
  function toggleType(t: AiJobType) {
    onTypesChange(
      selectedTypes.includes(t) ? selectedTypes.filter((x) => x !== t) : [...selectedTypes, t],
    );
  }
  function toggleStatus(s: AiJobStatus) {
    onStatusesChange(
      selectedStatuses.includes(s) ? selectedStatuses.filter((x) => x !== s) : [...selectedStatuses, s],
    );
  }

  return (
    <div className="flex h-full w-[240px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">

      {/* Feature Type */}
      <FilterSection title="Feature Type">
        {ALL_TYPES.map((t) => {
          const meta = JOB_TYPE_META[t];
          return (
            <label key={t} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-800/60">
              <input
                type="checkbox"
                checked={selectedTypes.includes(t)}
                onChange={() => toggleType(t)}
                className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600 dark:border-slate-600"
              />
              <span className={meta.color}>{meta.icon}</span>
              <span className="flex-1 truncate text-xs text-slate-700 dark:text-slate-300">{meta.label}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-600">{typeCounts[t] ?? 0}</span>
            </label>
          );
        })}
      </FilterSection>

      {/* Status */}
      <FilterSection title="Status">
        {ALL_STATUSES.map((s) => {
          const meta = STATUS_META[s];
          return (
            <label key={s} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-800/60">
              <input
                type="checkbox"
                checked={selectedStatuses.includes(s)}
                onChange={() => toggleStatus(s)}
                className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600 dark:border-slate-600"
              />
              <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.cls}`}>
                {meta.label}
              </span>
              <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-600">{statusCounts[s] ?? 0}</span>
            </label>
          );
        })}
      </FilterSection>

      {/* Date Range */}
      <FilterSection title="Date Range">
        {(['1h', '1d', '7d', '30d', 'all'] as const).map((r) => (
          <label key={r} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-800/60">
            <input
              type="radio"
              name="dateRange"
              checked={dateRange === r}
              onChange={() => onDateRangeChange(r)}
              className="accent-blue-600"
            />
            <span className="text-xs text-slate-700 dark:text-slate-300">
              {r === '1h' ? 'Past 1 hour' : r === '1d' ? 'Past 24 hours' : r === '7d' ? 'Past 7 days' : r === '30d' ? 'Past 30 days' : 'All time'}
            </span>
          </label>
        ))}
      </FilterSection>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-slate-200 dark:border-slate-800">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
      >
        {title}
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && <div className="px-1 pb-2">{children}</div>}
    </div>
  );
}

// ── Trace Row ─────────────────────────────────────────────────────────────────

function TraceRow({
  job, expanded, onToggle, onCancel, onNavigate,
}: {
  job: AiJobListItem;
  expanded: boolean;
  onToggle: () => void;
  onCancel: (id: string) => void;
  onNavigate: (job: AiJobListItem) => void;
}) {
  const typeMeta = JOB_TYPE_META[job.type] ?? JOB_TYPE_META.THREAT_ANALYSIS;
  const statusMeta = STATUS_META[job.status] ?? STATUS_META.PENDING;
  const canCancel = job.status === 'RUNNING' || job.status === 'PENDING';

  return (
    <>
      <tr
        className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/30"
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap dark:text-slate-400">
          <span title={new Date(job.createdAt).toLocaleString()}>
            {formatRelative(job.createdAt)}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={typeMeta.color}>{typeMeta.icon}</span>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{typeMeta.label}</span>
          </div>
        </td>
        <td className="max-w-[160px] truncate px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
          {job.projectName ?? (job.projectId ? shortId(job.projectId) : '—')}
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusMeta.cls}`}>
            {job.status === 'RUNNING' && <Loader2 size={9} className="animate-spin" />}
            {statusMeta.label}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
          {formatDuration(job)}
        </td>
        <td className="px-4 py-3">
          {job.status === 'RUNNING' ? (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-20 rounded-full bg-slate-200 dark:bg-slate-700">
                <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${job.progress}%` }} />
              </div>
              <span className="text-[10px] text-slate-400">{job.progress}%</span>
            </div>
          ) : (
            <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
          )}
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            {job.status === 'COMPLETED' && job.projectId && (
              <button
                onClick={() => onNavigate(job)}
                title="View in project"
                className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700 dark:hover:text-blue-400"
              >
                <ExternalLink size={13} />
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => onCancel(job.id)}
                title="Cancel job"
                className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-700 dark:hover:text-red-400"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-slate-50 dark:bg-slate-900/60">
          <td colSpan={7} className="px-6 py-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
              <DetailField label="Job ID" value={job.id} mono />
              <DetailField label="Diagram ID" value={job.diagramId ?? '—'} mono />
              <DetailField label="Layer ID" value={job.layerId ?? '—'} mono />
              <DetailField label="Result Ref" value={job.resultRef ?? '—'} mono />
              {job.startedAt && <DetailField label="Started" value={new Date(job.startedAt).toLocaleString()} />}
              {job.completedAt && <DetailField label="Completed" value={new Date(job.completedAt).toLocaleString()} />}
              {job.errorMessage && (
                <div className="col-span-2">
                  <p className="mb-1 text-slate-400">Error</p>
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-mono text-red-600 dark:border-red-800/40 dark:bg-red-950/40 dark:text-red-400">
                    {job.errorMessage}
                  </p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="mb-0.5 text-slate-400 dark:text-slate-600">{label}</p>
      <p className={`truncate text-slate-700 dark:text-slate-300 ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</p>
    </div>
  );
}

// ── Empty / Loading States ────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 px-4 py-3.5">
          <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-32 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-5 w-20 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-12 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onGoProjects }: { onGoProjects: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-8 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
        <Activity size={28} className="text-slate-400 dark:text-slate-600" />
      </div>
      <div>
        <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No AI activity found</p>
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500">
          Try adjusting your filters, or run a Threat Analysis, Attack Simulation, or Posture Score on a diagram.
        </p>
      </div>
      <button
        onClick={onGoProjects}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        <FolderOpen size={14} />
        Go to a Project
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AIActivityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const user = isLoggedIn() ? getStoredUser() : null;

  const [selectedTypes, setSelectedTypes] = useState<AiJobType[]>(() => {
    const t = searchParams.get('types');
    return t ? (t.split(',') as AiJobType[]) : [];
  });
  const [selectedStatuses, setSelectedStatuses] = useState<AiJobStatus[]>(() => {
    const s = searchParams.get('statuses');
    return s ? (s.split(',') as AiJobStatus[]) : [];
  });
  const [dateRange, setDateRange] = useState<DateRange | 'all'>(() => {
    return (searchParams.get('range') as DateRange | 'all') ?? '7d';
  });
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [activeType, setActiveType] = useState<AiJobType | null>(null);

  const [jobs, setJobs] = useState<AiJobListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buildFilters = useCallback((): AiActivityFilters => {
    const types = activeType ? [activeType] : selectedTypes.length ? selectedTypes : undefined;
    return {
      types,
      statuses: selectedStatuses.length ? selectedStatuses : undefined,
      dateRange: dateRange === 'all' ? undefined : dateRange,
      search: search || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    };
  }, [activeType, selectedTypes, selectedStatuses, dateRange, search, page]);

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await apiListActivity(buildFilters());
      setJobs(result.jobs);
      setTotal(result.total);
    } catch {
      // ignore auth errors
    } finally {
      if (!silent) setLoading(false);
    }
  }, [buildFilters]);

  useEffect(() => { void fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    const hasRunning = jobs.some((j) => j.status === 'RUNNING' || j.status === 'PENDING');
    if (hasRunning) {
      autoRefreshRef.current = setInterval(() => void fetchJobs(true), 8000);
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [jobs, fetchJobs]);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setPage(0), 300);
  };

  const handleCancel = async (jobId: string) => {
    try {
      await apiCancelJob(jobId);
      void fetchJobs(true);
    } catch { /* ignore */ }
  };

  const handleNavigate = (job: AiJobListItem) => {
    if (job.projectId) router.push(`/projects/${job.projectId}`);
  };

  const handleSignOut = () => {
    signOut();
    router.push('/projects');
  };

  const handleTypeFilter = (t: AiJobType | null) => {
    setActiveType(t);
    setSelectedTypes([]);
    setPage(0);
  };

  const typeCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  for (const j of jobs) {
    typeCounts[j.type] = (typeCounts[j.type] ?? 0) + 1;
    statusCounts[j.status] = (statusCounts[j.status] ?? 0) + 1;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex h-screen overflow-hidden bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-300">
      {/* Sidebar */}
      <Sidebar
        activeType={activeType}
        onTypeFilter={handleTypeFilter}
        typeCounts={typeCounts}
        user={user}
        onSignOut={handleSignOut}
      />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5 dark:border-slate-800 dark:bg-slate-950">
          <Activity size={15} className="shrink-0 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">AI Traces</span>
          <div className="mx-2 h-4 w-px bg-slate-200 dark:bg-slate-800" />

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              showFilters
                ? 'border border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800/50 dark:bg-blue-900/30 dark:text-blue-300'
                : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <Filter size={12} />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>

          <div className="flex max-w-sm flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
            <Search size={12} className="shrink-0 text-slate-400" />
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by diagram ID…"
              className="flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-600"
            />
          </div>

          <div className="flex items-center gap-1">
            {DATE_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => { setDateRange(r); setPage(0); }}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  dateRange === r
                    ? 'border border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800/50 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-800 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => void fetchJobs()}
              title="Refresh"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              <RotateCcw size={13} />
            </button>
            <span className="text-xs text-slate-400">{total} traces</span>
          </div>
        </div>

        {/* Stats row */}
        {!loading && jobs.length > 0 && <StatsRow jobs={jobs} />}

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">

          {showFilters && (
            <FilterPanel
              selectedTypes={selectedTypes}
              selectedStatuses={selectedStatuses}
              dateRange={dateRange}
              onTypesChange={(t) => { setSelectedTypes(t); setPage(0); }}
              onStatusesChange={(s) => { setSelectedStatuses(s); setPage(0); }}
              onDateRangeChange={(r) => { setDateRange(r); setPage(0); }}
              typeCounts={typeCounts}
              statusCounts={statusCounts}
            />
          )}

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-auto">
              {loading ? (
                <LoadingSkeleton />
              ) : jobs.length === 0 ? (
                <EmptyState onGoProjects={() => router.push('/projects')} />
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-slate-950">
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      {['Timestamp', 'Feature', 'Project', 'Status', 'Duration', 'Progress', 'Actions'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <TraceRow
                        key={job.id}
                        job={job}
                        expanded={expandedId === job.id}
                        onToggle={() => setExpandedId((prev) => (prev === job.id ? null : job.id))}
                        onCancel={handleCancel}
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-950">
                <span className="text-xs text-slate-400">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 0}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs text-slate-400">{page + 1} / {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages - 1}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
