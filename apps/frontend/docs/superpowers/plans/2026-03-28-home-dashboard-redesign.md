# Home Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the project-list sidebar and empty default state with a feature-first sidebar and cross-project AI security dashboard.

**Architecture:** All data fetching lifts into `AppShell` (projects every 60s, active jobs every 8s, recent activity once). Two new presentational components — `HomeSidebar` and `AllProjectsDashboard` — receive data as props. `ProjectSidebar` is deleted. No backend changes.

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS (`dark:` variants throughout), lucide-react, existing `apiGetProjectsSummary` + `apiListActivity` from `@/lib/api`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `components/HomeSidebar.tsx` | **Create** | Feature-first sidebar: AI Dashboard nav + projects sub-list + bottom bar |
| `components/AllProjectsDashboard.tsx` | **Create** | Cross-project overview: hero stats + risk table + activity feed |
| `components/AppShell.tsx` | **Rewrite** | Data fetching hub; computes aggregates; routes to all views |
| `components/ProjectSidebar.tsx` | **Delete** | Superseded by HomeSidebar |

---

## Task 1: Rewrite AppShell — lift data fetching, add view routing

**Files:**
- Rewrite: `components/AppShell.tsx`

- [ ] **Step 1: Replace the file with the new AppShell**

```tsx
// components/AppShell.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Layers } from 'lucide-react';
import { isLoggedIn } from '@/lib/authStore';
import {
  apiGetProjectsSummary, apiListActivity,
  type ProjectSummary, type AiJobListItem,
} from '@/lib/api';
import HomeSidebar from './HomeSidebar';
import AllProjectsDashboard from './AllProjectsDashboard';
import ProjectCommandCenter from './ProjectCommandCenter';
import NewProjectChat from './NewProjectChat';
import AiSettingsPage from './AiSettingsPage';

type ActiveView = 'all-projects' | 'project' | 'new-project' | 'settings';

export default function AppShell() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  // View state
  const [activeView, setActiveView] = useState<ActiveView>('all-projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Data
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [activeJobs, setActiveJobs] = useState<AiJobListItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<AiJobListItem[]>([]);
  const [attackSimTotal, setAttackSimTotal] = useState(0);

  // Auth check
  useEffect(() => {
    const loggedIn = isLoggedIn();
    setAuthed(loggedIn);
    if (!loggedIn) router.replace('/login');
  }, [router]);

  // Projects — poll every 60s
  const loadProjects = useCallback(async () => {
    try {
      const data = await apiGetProjectsSummary();
      setProjects(data);
    } catch { /* ignore */ }
    finally { setLoadingProjects(false); }
  }, []);

  useEffect(() => {
    void loadProjects();
    const id = setInterval(loadProjects, 60_000);
    return () => clearInterval(id);
  }, [loadProjects]);

  // Active jobs — poll every 8s
  useEffect(() => {
    const poll = async () => {
      try {
        const result = await apiListActivity({ statuses: ['RUNNING', 'PENDING'], limit: 20 });
        setActiveJobs(result.jobs);
      } catch { /* ignore */ }
    };
    void poll();
    const id = setInterval(poll, 8_000);
    return () => clearInterval(id);
  }, []);

  // Recent activity + attack sim total — load once on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [recent, sims] = await Promise.all([
          apiListActivity({ limit: 10 }),
          apiListActivity({ types: ['ATTACK_SIMULATION'], statuses: ['COMPLETED'] }),
        ]);
        setRecentActivity(recent.jobs);
        setAttackSimTotal(sims.total);
      } catch { /* ignore */ }
    };
    void load();
  }, []);

  // Computed aggregates
  const totalThreats = useMemo(
    () => projects.reduce((s, p) => s + p.openThreatCount, 0),
    [projects],
  );
  const criticalThreats = useMemo(
    () => projects.reduce((s, p) => s + p.criticalThreatCount, 0),
    [projects],
  );
  const avgPosture = useMemo(() => {
    const scored = projects.filter((p) => p.latestPostureScore !== null);
    if (scored.length === 0) return null;
    return Math.round(scored.reduce((s, p) => s + p.latestPostureScore!, 0) / scored.length);
  }, [projects]);

  // Handlers
  const handleSelectProject = useCallback((id: string) => {
    setSelectedProjectId(id);
    setActiveView('project');
  }, []);

  const handleNewProject = useCallback(() => {
    setSelectedProjectId(null);
    setActiveView('new-project');
  }, []);

  const handleProjectCreated = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    void loadProjects();
  }, [loadProjects]);

  const handleOpenSettings = useCallback(() => {
    setSelectedProjectId(null);
    setActiveView('settings');
  }, []);

  const handleShowDashboard = useCallback(() => {
    setSelectedProjectId(null);
    setActiveView('all-projects');
  }, []);

  if (authed === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Layers size={24} className="animate-pulse text-blue-500" />
      </div>
    );
  }

  if (!authed) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <HomeSidebar
        selectedProjectId={selectedProjectId}
        onSelectProject={handleSelectProject}
        onNewProject={handleNewProject}
        onOpenSettings={handleOpenSettings}
        onShowDashboard={handleShowDashboard}
        projects={projects}
        loadingProjects={loadingProjects}
        activeJobCount={activeJobs.length}
        totalThreats={totalThreats}
        criticalThreats={criticalThreats}
        avgPosture={avgPosture}
        attackSimTotal={attackSimTotal}
      />

      <main className="flex-1 overflow-hidden">
        {activeView === 'new-project' ? (
          <NewProjectChat
            onDismiss={handleShowDashboard}
            onCreated={handleProjectCreated}
          />
        ) : activeView === 'settings' ? (
          <AiSettingsPage />
        ) : activeView === 'project' && selectedProjectId ? (
          <ProjectCommandCenter key={selectedProjectId} projectId={selectedProjectId} />
        ) : (
          <AllProjectsDashboard
            projects={projects}
            activeJobs={activeJobs}
            recentActivity={recentActivity}
            attackSimTotal={attackSimTotal}
            totalThreats={totalThreats}
            criticalThreats={criticalThreats}
            avgPosture={avgPosture}
            loading={loadingProjects}
            onSelectProject={handleSelectProject}
            onNewProject={handleNewProject}
            onRefresh={loadProjects}
          />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript is happy so far (HomeSidebar + AllProjectsDashboard don't exist yet — expect import errors only)**

```bash
cd /Users/sunil/Development/github/drafter && npx tsc --noEmit 2>&1 | grep -v "Cannot find module './HomeSidebar'" | grep -v "Cannot find module './AllProjectsDashboard'"
```

Expected: no errors beyond the two missing module errors.

- [ ] **Step 3: Commit**

```bash
git add components/AppShell.tsx
git commit -m "refactor: lift data fetching into AppShell, add view routing"
```

---

## Task 2: Create HomeSidebar

**Files:**
- Create: `components/HomeSidebar.tsx`

- [ ] **Step 1: Create the file**

```tsx
// components/HomeSidebar.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Layers, Plus, LogOut, ChevronLeft, ChevronRight,
  Shield, Search, BarChart2, Sword, Zap,
  Settings, Activity, Sun, Moon, Monitor, User, ChevronDown,
} from 'lucide-react';
import { type ProjectSummary } from '@/lib/api';
import { getStoredUser, clearTokens } from '@/lib/authStore';
import { useTheme } from '@/lib/themeContext';
import type { Theme } from '@/lib/themeStore';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
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
  projects: ProjectSummary[];
  loadingProjects: boolean;
  activeJobCount: number;
  totalThreats: number;
  criticalThreats: number;
  avgPosture: number | null;
  attackSimTotal: number;
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
  onOpenSettings, onShowDashboard,
  projects, loadingProjects,
  activeJobCount, totalThreats, criticalThreats, avgPosture, attackSimTotal,
}: HomeSidebarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const user = getStoredUser();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('drafter_sidebar_collapsed') === 'true';
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
          localStorage.setItem('drafter_sidebar_collapsed', String(next));
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
    localStorage.setItem('drafter_sidebar_collapsed', String(next));
  };

  const cycleTheme = () => {
    setTheme(THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length]);
  };

  const handleSignOut = () => {
    clearTokens();
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
        <Layers size={18} className="shrink-0 text-blue-600 dark:text-blue-500" />
        {!collapsed && (
          <>
            <span className="text-[15px] font-bold text-slate-900 dark:text-white">Drafter</span>
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
          collapsed={collapsed}
          onClick={onShowDashboard}
        />
        <NavItem
          icon={<BarChart2 size={14} />}
          label="Posture Score"
          badge={avgPosture ?? '—'}
          badgeColor={postureBadgeColor}
          collapsed={collapsed}
          onClick={onShowDashboard}
        />
        <NavItem
          icon={<Sword size={14} />}
          label="Attack Sims"
          badge={attackSimTotal}
          badgeColor="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
          collapsed={collapsed}
          onClick={onShowDashboard}
        />
        <NavItem
          icon={<Zap size={14} />}
          label="Active Jobs"
          badge={activeJobCount > 0 ? activeJobCount : undefined}
          badgeColor="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
          pulse={activeJobCount > 0}
          collapsed={collapsed}
          onClick={onShowDashboard}
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
                {/* Search */}
                <div className="mb-1 px-2">
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
          <NavItem
            icon={<Settings size={14} />}
            label="AI Settings"
            collapsed={collapsed}
            onClick={onOpenSettings}
          />
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
```

- [ ] **Step 2: Type check**

```bash
cd /Users/sunil/Development/github/drafter && npx tsc --noEmit 2>&1 | grep -v "Cannot find module './AllProjectsDashboard'"
```

Expected: no errors except the one missing module.

- [ ] **Step 3: Commit**

```bash
git add components/HomeSidebar.tsx
git commit -m "feat: add HomeSidebar — feature-first sidebar with AI Dashboard nav"
```

---

## Task 3: Create AllProjectsDashboard

**Files:**
- Create: `components/AllProjectsDashboard.tsx`

- [ ] **Step 1: Create the file**

```tsx
// components/AllProjectsDashboard.tsx
'use client';

import { useRouter } from 'next/navigation';
import {
  Shield, BarChart2, Sword, Wand2, Zap, Plus,
  RotateCcw, Layers, AlertTriangle, ExternalLink, Activity,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { type ProjectSummary, type AiJobListItem } from '@/lib/api';
import { cn } from '@/lib/utils';

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
  'bg-indigo-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
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

// ── Sort projects by risk ─────────────────────────────────────────────────────

function sortByRisk(projects: ProjectSummary[]): ProjectSummary[] {
  return [...projects].sort((a, b) => {
    // Critical threats first
    if (b.criticalThreatCount !== a.criticalThreatCount) return b.criticalThreatCount - a.criticalThreatCount;
    // Then worst posture (null = unscored goes after scored)
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
}: AllProjectsDashboardProps) {
  const router = useRouter();
  const sorted = sortByRisk(projects);
  const scoredCount = projects.filter((p) => p.latestPostureScore !== null).length;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">

      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-[20px] font-bold text-slate-900 dark:text-slate-100">Security Overview</h1>
        {!loading && (
          <span className="text-[13px] text-slate-400">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </span>
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
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            New Project
          </button>
        </div>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

        {/* Hero stats */}
        {loading ? (
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
        )}

        {/* Active jobs strip */}
        {activeJobs.length > 0 && (
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

        {/* Projects table */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10" />
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Layers size={40} className="mb-4 text-slate-300 dark:text-slate-600" />
            <p className="text-[16px] font-semibold text-slate-700 dark:text-slate-200">No projects yet</p>
            <p className="mt-1.5 max-w-sm text-[13px] text-slate-400 leading-relaxed">
              Create your first architecture diagram to start your security analysis.
            </p>
            <button
              onClick={onNewProject}
              className="mt-5 flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-[14px] font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Plus size={15} />
              New Project
            </button>
          </div>
        ) : (
          <section>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_140px_130px_100px_160px] border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
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
                    className="grid cursor-pointer grid-cols-[1fr_140px_130px_100px_160px] items-center border-b border-slate-100 px-4 py-3 transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
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
                        Diagram
                      </button>
                      {p.openThreatCount > 0 && (
                        <button
                          onClick={() => router.push(`/projects/${p.id}/threats`)}
                          className="flex items-center gap-1 rounded-md border border-orange-200 px-2.5 py-1 text-[12px] font-medium text-orange-600 hover:bg-orange-50 dark:border-orange-800/50 dark:text-orange-400 dark:hover:bg-orange-950/30"
                        >
                          <AlertTriangle size={11} />
                          Threats
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
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
    </div>
  );
}
```

- [ ] **Step 2: Type check — expect zero errors**

```bash
cd /Users/sunil/Development/github/drafter && npx tsc --noEmit 2>&1
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add components/AllProjectsDashboard.tsx
git commit -m "feat: add AllProjectsDashboard — cross-project security overview"
```

---

## Task 4: Delete ProjectSidebar + final verification

**Files:**
- Delete: `components/ProjectSidebar.tsx`

- [ ] **Step 1: Remove ProjectSidebar**

```bash
rm /Users/sunil/Development/github/drafter/components/ProjectSidebar.tsx
```

- [ ] **Step 2: Check nothing else imports it**

```bash
cd /Users/sunil/Development/github/drafter && grep -r "ProjectSidebar" --include="*.tsx" --include="*.ts" .
```

Expected: no output (zero references).

- [ ] **Step 3: Final type check**

```bash
cd /Users/sunil/Development/github/drafter && npx tsc --noEmit 2>&1
```

Expected: no output (zero errors).

- [ ] **Step 4: Build check**

```bash
cd /Users/sunil/Development/github/drafter && npm run build 2>&1 | tail -20
```

Expected: `Route (app) ...` table with no errors.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: home dashboard redesign — feature-first sidebar + cross-project security overview"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ HomeSidebar: feature-first AI Dashboard nav with live badges — Task 2
- ✅ Projects sub-section with search + posture bars + crit badge — Task 2
- ✅ Collapse toggle + ⌘\ shortcut + localStorage persist — Task 2
- ✅ Bottom bar: Activity, AI Settings, theme cycle, user + sign out — Task 2
- ✅ AllProjectsDashboard: top bar with title + project count + refresh + new project — Task 3
- ✅ Hero stats: Open Threats, Avg Posture, Attack Sims, Active Jobs — Task 3
- ✅ Active jobs strip — Task 3
- ✅ Risk-sorted projects table — Task 3
- ✅ Recent activity feed — Task 3
- ✅ Empty state for no projects — Task 3
- ✅ AppShell: data fetching lifted, view routing, computed aggregates — Task 1
- ✅ Default view = `all-projects` — Task 1
- ✅ No auto-select-first-project — Task 1
- ✅ Full light/dark theme support on both components — all tasks (dark: variants throughout)
- ✅ ProjectSidebar deleted — Task 4

**Type consistency:**
- `HomeSidebarProps` defined in Task 2, consumed in Task 1 ✅
- `AllProjectsDashboardProps` defined in Task 3, consumed in Task 1 (includes `onRefresh`) ✅
- `AiJobListItem` used for `activeJobs` and `recentActivity` arrays — matches `apiListActivity` return type ✅
- `ProjectSummary` passed from AppShell to both sidebar and dashboard ✅
