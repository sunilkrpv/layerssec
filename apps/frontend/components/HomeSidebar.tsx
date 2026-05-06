'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Layers, Plus, LogOut, ChevronLeft, ChevronRight,
  Shield, Search, BarChart2, Sword, Zap, Home,
  Settings, Activity, Sun, Moon, Monitor, ChevronDown,
  FolderKanban,
} from 'lucide-react';
import LayersLogo from '@/components/LayersLogo';
import { type ProjectSummary } from '@/lib/api';
import { getStoredUser, signOut } from '@/lib/authStore';
import { useTheme } from '@/lib/themeContext';
import type { Theme } from '@/lib/themeStore';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function postureBarColor(score: number | null): string {
  if (score === null) return 'bg-slate-300 dark:bg-slate-600';
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function postureTextColor(score: number | null): string {
  if (score === null) return 'text-slate-400 dark:text-slate-600';
  if (score >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

const THEME_CYCLE: Theme[] = ['light', 'dark', 'system'];
const THEME_ICONS: Record<Theme, React.ReactNode> = {
  light: <Sun size={13} />,
  dark: <Moon size={13} />,
  system: <Monitor size={13} />,
};
const THEME_LABELS: Record<Theme, string> = { light: 'Light', dark: 'Dark', system: 'System' };

// ── Props ─────────────────────────────────────────────────────────────────────

export interface HomeSidebarProps {
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onOpenSettings: () => void;
  onShowDashboard: () => void;
  onShowMyProjects: () => void;
  onShowThreats: () => void;
  onShowPosture: () => void;
  projects: ProjectSummary[];
  loadingProjects: boolean;
  activeJobCount: number;
  totalThreats: number;
  criticalThreats: number;
  avgPosture: number | null;
  attackSimTotal: number;
  activeView: string;
}

// ── NavItem ───────────────────────────────────────────────────────────────────

function NavItem({
  icon, label, badge, badgeColor, active, collapsed, onClick, pulse,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string | number;
  badgeColor?: string;
  active?: boolean;
  collapsed?: boolean;
  onClick: () => void;
  pulse?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
        collapsed && 'justify-center px-2',
        active
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200',
      )}
    >
      <span className={cn('shrink-0', active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500')}>
        {icon}
      </span>
      {!collapsed && <span className="flex-1 truncate text-[13px] font-medium">{label}</span>}
      {!collapsed && badge !== undefined && (
        <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold', badgeColor ?? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400')}>
          {badge}
          {pulse && <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />}
        </span>
      )}
    </button>
  );
}

// ── HomeSidebar ───────────────────────────────────────────────────────────────

export default function HomeSidebar({
  selectedProjectId, onSelectProject, onNewProject,
  onOpenSettings, onShowDashboard, onShowMyProjects, onShowThreats, onShowPosture,
  projects, loadingProjects,
  activeJobCount, totalThreats, criticalThreats, avgPosture, attackSimTotal,
  activeView,
}: HomeSidebarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const user = getStoredUser();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('layers_sidebar_collapsed') === 'true';
  });
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [search, setSearch] = useState('');

  // ⌘\ to toggle collapse
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === '\\') {
        e.preventDefault();
        setCollapsed((prev) => {
          const next = !prev;
          localStorage.setItem('layers_sidebar_collapsed', String(next));
          return next;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('layers_sidebar_collapsed', String(next));
  };

  const cycleTheme = () => {
    setTheme(THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length]);
  };

  const handleSignOut = () => {
    signOut();
    router.push('/login');
  };

  const filtered = search
    ? projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : projects;

  // Badge colours for AI Dashboard items
  const threatBadgeColor = criticalThreats > 0
    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

  const postureBadgeColor = avgPosture === null
    ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
    : avgPosture >= 75
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
    : avgPosture >= 50
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';

  return (
    <aside
      className={cn(
        'relative flex h-screen flex-col border-r border-slate-200 bg-slate-100 transition-all duration-200 dark:border-slate-800 dark:bg-slate-950',
        collapsed ? 'w-16' : 'w-[260px]',
      )}
    >
      {/* Header */}
      <div className={cn(
        'flex h-14 shrink-0 items-center border-b border-slate-200 dark:border-slate-800',
        collapsed ? 'justify-center px-2' : 'gap-2 px-4',
      )}>
        <LayersLogo size={18} className="shrink-0 text-blue-600 dark:text-blue-500" />
        {!collapsed && (
          <>
            <span className="text-[15px] font-bold text-slate-900 dark:text-white">Layers</span>
            <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Security Platform
            </span>
          </>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleCollapse}
        className="absolute -right-3 top-16 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      <div className="flex-1 overflow-y-auto py-3">

        <NavItem
          icon={<Home size={14} />}
          label="Home"
          active={activeView === 'all-projects'}
          collapsed={collapsed}
          onClick={onShowDashboard}
        />

        <div className="my-3 border-t border-slate-200 dark:border-slate-800" />

        {/* AI Dashboard section */}
        {!collapsed && (
          <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-600">
            AI Dashboard
          </p>
        )}
        <NavItem
          icon={<Shield size={14} />}
          label="Threats"
          badge={totalThreats}
          badgeColor={threatBadgeColor}
          active={activeView === 'threats'}
          collapsed={collapsed}
          onClick={onShowThreats}
        />
        <NavItem
          icon={<BarChart2 size={14} />}
          label="Posture Score"
          badge={avgPosture ?? '—'}
          badgeColor={postureBadgeColor}
          active={activeView === 'posture'}
          collapsed={collapsed}
          onClick={onShowPosture}
        />
        <NavItem
          icon={<Sword size={14} />}
          label="Attack Sims"
          badge={attackSimTotal}
          badgeColor="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
          collapsed={collapsed}
          onClick={() => router.push('/activity?types=ATTACK_SIMULATION')}
        />
        <NavItem
          icon={<Zap size={14} />}
          label="Active Jobs"
          badge={activeJobCount > 0 ? activeJobCount : undefined}
          badgeColor="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
          pulse={activeJobCount > 0}
          collapsed={collapsed}
          onClick={() => router.push('/activity?statuses=RUNNING,PENDING')}
        />

        <div className="my-3 border-t border-slate-200 dark:border-slate-800" />

        {/* Projects section */}
        {!collapsed ? (
          <>
            <button
              onClick={() => setProjectsOpen((v) => !v)}
              className="mb-1 flex w-full items-center justify-between px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400"
            >
              Projects
              <ChevronDown size={10} className={cn('transition-transform', !projectsOpen && '-rotate-90')} />
            </button>

            {projectsOpen && (
              <>
                {/* My Projects */}
                <NavItem
                  icon={<FolderKanban size={14} />}
                  label="My Projects"
                  badge={projects.length > 0 ? projects.length : undefined}
                  active={activeView === 'my-projects'}
                  collapsed={collapsed}
                  onClick={onShowMyProjects}
                />

                {/* Search */}
                <div className="mb-1 mt-1 px-2">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900">
                    <Search size={12} className="shrink-0 text-slate-400" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search projects…"
                      className="flex-1 bg-transparent text-[12px] text-slate-700 placeholder-slate-400 outline-none dark:text-slate-200"
                    />
                  </div>
                </div>

                {/* Project list */}
                <div className="px-2">
                  {loadingProjects ? (
                    <div className="flex flex-col gap-1.5 p-1">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
                      ))}
                    </div>
                  ) : filtered.length === 0 ? (
                    <p className="px-3 py-3 text-[12px] text-slate-400">
                      {search ? 'No results' : 'No projects yet'}
                    </p>
                  ) : (
                    filtered.map((p) => {
                      const selected = selectedProjectId === p.id;
                      const color = avatarColor(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => onSelectProject(p.id)}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg border-l-2 px-2 py-2 text-left transition-colors',
                            selected
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-transparent hover:bg-slate-200/60 dark:hover:bg-slate-800/60',
                          )}
                        >
                          <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white', color)}>
                            {initials(p.name) || <Layers size={12} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                'truncate text-[13px] font-medium',
                                selected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-100',
                              )}>
                                {p.name}
                              </span>
                              {p.criticalThreatCount > 0 && (
                                <span className="shrink-0 rounded bg-red-100 px-1 py-0.5 text-[9px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-400">
                                  {p.criticalThreatCount} CRIT
                                </span>
                              )}
                            </div>
                            {/* Posture bar */}
                            <div className="mt-1 flex items-center gap-1.5">
                              <div className="h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700">
                                <div
                                  className={cn('h-1 rounded-full', postureBarColor(p.latestPostureScore))}
                                  style={{ width: `${p.latestPostureScore ?? 0}%` }}
                                />
                              </div>
                              <span className={cn('text-[10px] font-semibold tabular-nums', postureTextColor(p.latestPostureScore))}>
                                {p.latestPostureScore ?? '—'}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* New project */}
                <div className="px-2 pt-1">
                  <button
                    data-onboarding="new-project-btn"
                    onClick={onNewProject}
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed border-blue-300 px-3 py-2 text-[12px] font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/30"
                  >
                    <Plus size={13} />
                    New Project
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          /* Collapsed: show project avatars only */
          <div className="flex flex-col items-center gap-1 px-1">
            {projects.slice(0, 6).map((p) => {
              const color = avatarColor(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectProject(p.id)}
                  title={p.name}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-bold text-white transition-opacity',
                    color,
                    selectedProjectId === p.id ? 'ring-2 ring-blue-400' : 'opacity-70 hover:opacity-100',
                  )}
                >
                  {initials(p.name) || <Layers size={12} />}
                </button>
              );
            })}
            <button
              onClick={onNewProject}
              title="New Project"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-blue-400 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            >
              <Plus size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 border-t border-slate-200 dark:border-slate-800">
        <div className={cn('flex flex-col gap-0.5 px-2 py-2')}>
          <NavItem
            icon={<Activity size={14} />}
            label="Activity"
            collapsed={collapsed}
            onClick={() => router.push('/activity')}
          />
          <div data-onboarding="ai-settings-nav">
            <NavItem
              icon={<Settings size={14} />}
              label="AI Settings"
              collapsed={collapsed}
              onClick={onOpenSettings}
            />
          </div>
        </div>

        {/* Theme + user */}
        <div className={cn(
          'flex items-center border-t border-slate-200 px-3 py-2 dark:border-slate-800',
          collapsed ? 'justify-center' : 'justify-between',
        )}>
          <button
            onClick={cycleTheme}
            title={`Theme: ${THEME_LABELS[theme]} — click to cycle`}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-[12px] text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            {THEME_ICONS[theme]}
            {!collapsed && <span>{THEME_LABELS[theme]}</span>}
          </button>
        </div>

        {user && (
          <div className={cn(
            'flex items-center border-t border-slate-200 px-3 py-2.5 dark:border-slate-800',
            collapsed ? 'justify-center' : 'gap-2',
          )}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
              {user.email[0]?.toUpperCase()}
            </div>
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-[12px] text-slate-500 dark:text-slate-400">
                  {user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="ml-1 rounded p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400"
                >
                  <LogOut size={13} />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
