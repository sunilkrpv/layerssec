'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Shield, BarChart2, Sword, Wand2, Zap, Plus,
  RotateCcw, Layers, AlertTriangle, ExternalLink, Activity,
  CheckCircle2, XCircle, Pencil, Trash2,
} from 'lucide-react';
import { type ProjectSummary, type AiJobListItem } from '@/lib/api';
import { cn } from '@/lib/utils';
import EmptyProjectsState from './onboarding/EmptyProjectsState';
import ProjectEditModal from './ProjectEditModal';
import DeleteProjectModal from './DeleteProjectModal';
import ProjectsGuidePanel from './ProjectsGuidePanel';

// ── Helpers ───────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function scoreBarColor(score: number | null): string {
  if (score === null) return 'bg-slate-200 dark:bg-slate-700';
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function scoreTextColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

const FEATURE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  THREAT_ANALYSIS:   { label: 'Threat Analysis',   icon: <Shield size={13} />,   color: 'text-red-500 dark:text-red-400' },
  POSTURE_SCORE:     { label: 'Posture Score',     icon: <BarChart2 size={13} />, color: 'text-blue-500 dark:text-blue-400' },
  ATTACK_SIMULATION: { label: 'Attack Simulation', icon: <Sword size={13} />,    color: 'text-orange-500 dark:text-orange-400' },
  DECLUTTER:         { label: 'Declutter',         icon: <Wand2 size={13} />,    color: 'text-purple-500 dark:text-purple-400' },
};

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-sky-500', 'bg-teal-500', 'bg-orange-500',
];

function avatarColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

// ── Sort projects by risk / posture ───────────────────────────────────────────

function sortByRisk(projects: ProjectSummary[]): ProjectSummary[] {
  return [...projects].sort((a, b) => {
    if (b.criticalThreatCount !== a.criticalThreatCount) return b.criticalThreatCount - a.criticalThreatCount;
    if (a.latestPostureScore === null && b.latestPostureScore === null) return 0;
    if (a.latestPostureScore === null) return 1;
    if (b.latestPostureScore === null) return -1;
    return a.latestPostureScore - b.latestPostureScore;
  });
}

function sortByPosture(projects: ProjectSummary[]): ProjectSummary[] {
  return [...projects].sort((a, b) => {
    if (a.latestPostureScore === null && b.latestPostureScore === null) return 0;
    if (a.latestPostureScore === null) return 1;
    if (b.latestPostureScore === null) return -1;
    return a.latestPostureScore - b.latestPostureScore;
  });
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AllProjectsDashboardProps {
  projects: ProjectSummary[];
  activeJobs: AiJobListItem[];
  recentActivity: AiJobListItem[];
  attackSimTotal: number;
  totalThreats: number;
  criticalThreats: number;
  avgPosture: number | null;
  loading: boolean;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onRefresh: () => void;
  section?: 'all' | 'threats' | 'posture' | 'projects';
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, subColor, pulse,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  subColor?: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</p>
        <span className="text-slate-400 dark:text-slate-500">{icon}</span>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-[32px] font-bold leading-none text-slate-900 dark:text-white">{value}</p>
        {pulse && <span className="mb-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />}
      </div>
      {sub && (
        <p className={cn('mt-1 text-[12px]', subColor ?? 'text-slate-400')}>{sub}</p>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-slate-200 dark:bg-slate-700', className)} />;
}

// ── AllProjectsDashboard ──────────────────────────────────────────────────────

export default function AllProjectsDashboard({
  projects, activeJobs, recentActivity,
  attackSimTotal, totalThreats, criticalThreats, avgPosture,
  loading, onSelectProject, onNewProject, onRefresh,
  section = 'all',
}: AllProjectsDashboardProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<ProjectSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);

  const displayProjects = section === 'threats'
    ? sortByRisk(projects.filter((p) => p.openThreatCount > 0))
    : section === 'posture'
    ? sortByPosture(projects)
    : sortByRisk(projects);

  const sorted = displayProjects;
  const scoredCount = projects.filter((p) => p.latestPostureScore !== null).length;

  const title =
    section === 'threats' ? 'Open Threats'
    : section === 'posture' ? 'Posture Score'
    : section === 'projects' ? 'My Projects'
    : 'Security Overview';
  const subtitle = section === 'threats'
    ? `${displayProjects.length} project${displayProjects.length !== 1 ? 's' : ''} with open threats`
    : section === 'posture'
    ? `${scoredCount} of ${projects.length} projects scored`
    : `${projects.length} project${projects.length !== 1 ? 's' : ''}`;

  const showStats = section !== 'projects';
  const showRecent = section !== 'projects';

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">

      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-[20px] font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        {!loading && (
          <span className="text-[13px] text-slate-400">{subtitle}</span>
        )}
        <button
          onClick={onRefresh}
          title="Refresh"
          className="ml-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <RotateCcw size={14} />
        </button>
        <div className="ml-auto">
          <button
            onClick={onNewProject}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus size={14} />
            New Project
          </button>
        </div>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">

        {/* Hero stats */}
        {showStats && (loading ? (
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Shield size={16} />}
              label="Open Threats"
              value={totalThreats}
              sub={criticalThreats > 0 ? `${criticalThreats} critical` : 'None critical'}
              subColor={criticalThreats > 0 ? 'text-red-500 dark:text-red-400 font-semibold' : 'text-slate-400'}
            />
            <StatCard
              icon={<BarChart2 size={16} />}
              label="Avg Posture"
              value={avgPosture ?? '—'}
              sub={`${scoredCount} of ${projects.length} projects scored`}
              subColor={
                avgPosture === null ? 'text-slate-400'
                  : avgPosture >= 75 ? 'text-emerald-600 dark:text-emerald-400'
                  : avgPosture >= 50 ? 'text-amber-600 dark:text-amber-400'
                  : 'text-red-600 dark:text-red-400'
              }
            />
            <StatCard
              icon={<Sword size={16} />}
              label="Attack Simulations"
              value={attackSimTotal}
              sub="simulations completed"
            />
            <StatCard
              icon={<Zap size={16} />}
              label="Active Jobs"
              value={activeJobs.length}
              sub={activeJobs.length > 0 ? 'running now' : 'none running'}
              subColor={activeJobs.length > 0 ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-400'}
              pulse={activeJobs.length > 0}
            />
          </div>
        ))}

        {/* Active jobs strip */}
        {showStats && activeJobs.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 dark:border-blue-800/50 dark:bg-blue-950/30">
            <Zap size={13} className="shrink-0 text-blue-600 dark:text-blue-400" />
            <p className="flex-1 truncate text-[12px] text-blue-700 dark:text-blue-300">
              <span className="font-semibold">{activeJobs.length} {activeJobs.length === 1 ? 'analysis' : 'analyses'} running</span>
              {activeJobs.slice(0, 3).map((j) => {
                const meta = FEATURE_META[j.type];
                return (
                  <span key={j.id} className="ml-2 opacity-80">
                    · {meta?.label ?? j.type}{j.projectName ? ` on ${j.projectName}` : ''}
                  </span>
                );
              })}
            </p>
            <button
              onClick={() => router.push('/activity')}
              className="shrink-0 text-[12px] font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              View Activity →
            </button>
          </div>
        )}

        {/* Projects table (+ guide sidebar on 'projects' section) */}
        <div className={cn(section === 'projects' && 'grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]')}>
          <div className="min-w-0">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10" />
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : sorted.length === 0 ? (
          section === 'threats' ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Layers size={40} className="mb-4 text-slate-300 dark:text-slate-600" />
              <p className="text-[16px] font-semibold text-slate-700 dark:text-slate-200">No open threats</p>
              <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-slate-400">
                All projects are clean. Run a threat analysis to discover potential vulnerabilities.
              </p>
            </div>
          ) : (
            <EmptyProjectsState onNewProject={onNewProject} />
          )
        ) : (
          <section>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              {/* Table header */}
              <div className="grid min-w-[820px] grid-cols-[minmax(260px,1fr)_140px_130px_100px_220px] border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
                {['Project', 'Posture', 'Threats', 'Last Activity', 'Actions'].map((h) => (
                  <span key={h} className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {h}
                  </span>
                ))}
              </div>

              {/* Rows */}
              {sorted.map((p) => {
                const color = avatarColor(p.id);
                const sc = { bar: scoreBarColor(p.latestPostureScore), text: scoreTextColor(p.latestPostureScore) };
                return (
                  <div
                    key={p.id}
                    className="grid min-w-[820px] cursor-pointer grid-cols-[minmax(260px,1fr)_140px_130px_100px_220px] items-center border-b border-slate-100 px-4 py-3 transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                    onClick={() => onSelectProject(p.id)}
                  >
                    {/* Project */}
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold text-white', color)}>
                        {initials(p.name) || <Layers size={14} />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
                        {p.description && (
                          <p className="truncate text-[12px] text-slate-400">{p.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Posture */}
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={cn('h-1.5 rounded-full', sc.bar)}
                          style={{ width: `${p.latestPostureScore ?? 0}%` }}
                        />
                      </div>
                      <span className={cn('text-[13px] font-semibold tabular-nums', sc.text)}>
                        {p.latestPostureScore ?? '—'}
                      </span>
                    </div>

                    {/* Threats */}
                    <div>
                      {p.openThreatCount > 0 ? (
                        <>
                          <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">{p.openThreatCount}</p>
                          {p.criticalThreatCount > 0 && (
                            <p className="text-[11px] font-semibold text-red-500 dark:text-red-400">
                              {p.criticalThreatCount} critical
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-[13px] text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </div>

                    {/* Last activity */}
                    <p className="text-[12px] text-slate-400">{relTime(p.lastActivityAt)}</p>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => router.push(`/projects/${p.id}`)}
                        className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <ExternalLink size={11} />
                        Open
                      </button>
                      {section === 'projects' ? (
                        <button
                          onClick={() => setEditing(p)}
                          title="Edit name and description"
                          className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Pencil size={11} />
                          Edit
                        </button>
                      ) : p.openThreatCount > 0 && (
                        <button
                          onClick={() => router.push(`/projects/${p.id}/threats`)}
                          className="flex items-center gap-1 rounded-md border border-orange-200 px-2.5 py-1 text-[12px] font-medium text-orange-600 hover:bg-orange-50 dark:border-orange-800/50 dark:text-orange-400 dark:hover:bg-orange-950/30"
                        >
                          <AlertTriangle size={11} />
                          Threats
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(p)}
                        title="Delete project"
                        className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-red-800/50 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                      >
                        <Trash2 size={11} />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
          </div>
          {section === 'projects' && <ProjectsGuidePanel />}
        </div>

        {/* Recent Activity */}
        {showRecent && recentActivity.length > 0 && (
          <section>
            <h2 className="mb-2 text-[15px] font-semibold text-slate-700 dark:text-slate-200">Recent Activity</h2>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {recentActivity.map((job) => {
                const meta = FEATURE_META[job.type];
                const isCompleted = job.status === 'COMPLETED';
                const isFailed = job.status === 'FAILED';
                return (
                  <div key={job.id} className="flex items-center gap-3 py-3">
                    <span className={cn('shrink-0', meta?.color ?? 'text-slate-400')}>
                      {meta?.icon ?? <Activity size={13} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-slate-700 dark:text-slate-200">
                        <span className="font-medium">{meta?.label ?? job.type}</span>
                        {job.projectName && <span className="text-slate-400"> on {job.projectName}</span>}
                      </p>
                    </div>
                    {isCompleted && <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />}
                    {isFailed && <XCircle size={13} className="shrink-0 text-red-500" />}
                    <span className="shrink-0 text-[12px] text-slate-400">{relTime(job.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {editing && (
        <ProjectEditModal
          projectId={editing.id}
          initialName={editing.name}
          initialDescription={editing.description ?? null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onRefresh();
          }}
          onDeleted={() => {
            setEditing(null);
            onRefresh();
          }}
        />
      )}

      {deleteTarget && (
        <DeleteProjectModal
          project={{ id: deleteTarget.id, name: deleteTarget.name }}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
