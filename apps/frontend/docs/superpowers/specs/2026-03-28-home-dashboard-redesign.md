# Home Dashboard Redesign

**Date:** 2026-03-28
**Status:** Approved
**Scope:** `components/HomeSidebar.tsx` (new), `components/AllProjectsDashboard.tsx` (new), `components/AppShell.tsx` (modify)

---

## Problem

The current home page defaults to an empty "Select a project" state. The sidebar is project-list-only — AI features (threats, posture, attack sim) are third-class citizens buried at the bottom. There is no cross-project security overview. Users must click into each project individually to understand their overall security posture.

---

## Goal

Make the home page a genuine AI-powered security command center:
1. Default view shows aggregate security health across **all projects**
2. Sidebar is **feature-first** (AI Dashboard sections at top, projects as a sub-menu)
3. Navigation is intuitive: features → overview, project → per-project detail

---

## Architecture

### Component changes

| File | Change | Notes |
|------|--------|-------|
| `components/HomeSidebar.tsx` | **New** | Replaces `ProjectSidebar` in `AppShell`. Always-dark, feature-first sidebar |
| `components/AllProjectsDashboard.tsx` | **New** | Cross-project overview — default home view |
| `components/AppShell.tsx` | **Modify** | Use `HomeSidebar`, default `activeView` to `'all-projects'` |
| `components/ProjectSidebar.tsx` | **Delete** | Superseded by `HomeSidebar` |

No backend changes needed — all data computed client-side from existing endpoints:
- `apiGetProjectsSummary()` → `ProjectSummary[]` (posture, threat counts, last activity)
- `apiListActivity({ statuses: ['RUNNING','PENDING'], limit: 20 })` → active jobs
- `apiListActivity({ limit: 10 })` → recent activity feed

Attack sim total count: `apiListActivity({ types: ['ATTACK_SIMULATION'], statuses: ['COMPLETED'] })` → `total`.

---

## HomeSidebar (`components/HomeSidebar.tsx`)

### Visual design
- Always dark: `bg-slate-950 border-slate-800 text-slate-300`
- Width: `w-[260px]` expanded, `w-16` collapsed
- Collapsible via toggle button + `⌘\` keyboard shortcut
- Collapse state persisted in `localStorage` (`drafter_sidebar_collapsed`)

### Sections (top → bottom)

**Header (h-14, border-b)**
- Layers icon (blue-500) + "Drafter" bold white text
- "Security Platform" badge (`bg-slate-800 text-slate-400 text-[10px]`) — hidden when collapsed

**AI Dashboard section**
Section label: `AI DASHBOARD` (10px uppercase tracking-widest text-slate-600)

Four nav items, each shows a live count badge:
| Item | Icon | Badge data | Badge color |
|------|------|-----------|-------------|
| Threats | Shield | total `openThreatCount` across all projects | Red if `criticalThreatCount > 0`, else slate |
| Posture Score | BarChart2 | avg posture score (color-coded) | Green ≥75, amber ≥50, red <50 |
| Attack Sims | Sword | total completed attack sims | Orange |
| Active Jobs | Zap | count of RUNNING+PENDING jobs | Blue + pulsing dot if > 0 |

Clicking any of these sets `activeView = 'all-projects'` in AppShell (same view, future PRDs can add filtered sub-views).

**Projects section**
Section label: `PROJECTS` with collapse chevron toggle (open by default)

When expanded:
- Search input (`bg-slate-900 border-slate-800`)
- Scrollable project list, each item:
  - Color avatar (initials, deterministic color)
  - Project name (truncated)
  - Tiny posture score bar (thin, 40px wide) + score number
  - `⚠ N CRIT` red badge if `criticalThreatCount > 0`
- `[+ New Project]` dashed button at bottom of list
- Selected project: `bg-blue-900/30 text-blue-300 border-l-2 border-blue-500`

**Bottom section (border-t)**
- Activity (`Activity` icon) → `router.push('/activity')`
- AI Settings (`Settings` icon) → `onOpenSettings()`
- Theme cycle button (Sun/Moon/Monitor)
- User avatar + email (truncated) + sign out button

### Props
```typescript
interface HomeSidebarProps {
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
```

AppShell owns the data fetching and passes it down. This keeps `HomeSidebar` pure/presentational and avoids duplicate fetch calls between sidebar and dashboard.

---

## AllProjectsDashboard (`components/AllProjectsDashboard.tsx`)

### Top bar (h-14, border-b)
```
Security Overview    N projects    [↺]    [+ New Project]
```
- Title: `text-xl font-bold`
- Project count: `text-sm text-slate-500`
- Refresh icon button
- New Project button: `bg-blue-600`

### Hero stats row
4 equal-width cards (`rounded-xl border bg-white dark:bg-slate-900`):

1. **Open Threats** — `totalThreats`, subtitle `"{criticalThreats} critical"` (red if > 0)
2. **Avg Posture** — `avgPosture ?? "—"`, subtitle `"{scoredCount} of {total} projects scored"`, color-coded
3. **Attack Simulations** — `attackSimTotal`, subtitle `"simulations completed"`
4. **Active Jobs** — `activeJobCount`, subtitle `"running now"` with pulsing blue dot if > 0

### Active jobs strip
Shown only when `activeJobCount > 0`:
```
⚡ N analyses running · [job1 type] on [project] · [job2 type] on [project]   [View Activity →]
```
Styling: `bg-blue-950/40 border border-blue-800/50 text-blue-300 text-xs` strip above the table.

### Projects risk table
Sorted by risk: projects with `criticalThreatCount > 0` first, then by posture score ascending (worst first), then unscored projects, then no threats.

Columns:
| Column | Content |
|--------|---------|
| Project | Color avatar + name + description (1 line, truncated) |
| Posture | Colored bar (40px) + score number, or "—" if null |
| Threats | Total count + `"{N} critical"` red sub-label if any |
| Last Activity | Relative time (`relativeTime(lastActivityAt)`) |
| Actions | `[Open Diagram]` `[Threats →]` (Threats hidden if `openThreatCount === 0`) |

Table header: `text-[10px] uppercase tracking-wider text-slate-400`
Row hover: `hover:bg-slate-50 dark:hover:bg-slate-800/40`
Row click: selects the project (same as clicking in sidebar)

### Recent Activity feed
Title: "Recent Activity"
Data: `apiListActivity({ limit: 10 })` — shows last 10 AI job completions/failures across all projects.

Each row:
- Feature icon (colored: Shield=red, BarChart2=blue, Sword=orange, Wand2=purple)
- `"{type} on {projectName}"` — feature label + project name
- Status badge (Completed/Failed)
- Relative timestamp right-aligned

Empty state (no projects yet):
```
[Layers icon]
No projects yet
Create your first architecture diagram to start your security analysis.
[+ New Project]
```

---

## AppShell changes

```typescript
type ActiveView = 'all-projects' | 'project' | 'new-project' | 'settings';

// State
const [activeView, setActiveView] = useState<ActiveView>('all-projects');
const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
const [projects, setProjects] = useState<ProjectSummary[]>([]);
const [activeJobs, setActiveJobs] = useState<AiJobListItem[]>([]);
const [attackSimTotal, setAttackSimTotal] = useState(0);

// Data fetching (moved from ProjectSidebar into AppShell)
// - apiGetProjectsSummary() every 60s
// - apiListActivity({ statuses: ['RUNNING','PENDING'] }) every 8s
// - apiListActivity({ types: ['ATTACK_SIMULATION'], statuses: ['COMPLETED'] }) once on mount
```

Computed aggregates passed to both `HomeSidebar` and `AllProjectsDashboard`:
```typescript
const totalThreats = projects.reduce((s, p) => s + p.openThreatCount, 0);
const criticalThreats = projects.reduce((s, p) => s + p.criticalThreatCount, 0);
const scored = projects.filter(p => p.latestPostureScore !== null);
const avgPosture = scored.length > 0
  ? Math.round(scored.reduce((s, p) => s + p.latestPostureScore!, 0) / scored.length)
  : null;
```

Main content switch:
```
all-projects → <AllProjectsDashboard />
project      → <ProjectCommandCenter key={selectedProjectId} />
new-project  → <NewProjectChat />
settings     → <AiSettingsPage />
```

No auto-select-first-project behaviour — default is always `all-projects`.

---

## Theme support

Both `HomeSidebar` and `AllProjectsDashboard` must fully support light and dark themes via `dark:` Tailwind variants — no hardcoded dark colours.

`HomeSidebar` light: `bg-slate-100 border-slate-200 text-slate-700`
`HomeSidebar` dark: `bg-slate-950 border-slate-800 text-slate-300`

`AllProjectsDashboard` follows the same pattern as `ProjectCommandCenter`: `bg-white dark:bg-slate-900` cards, `border-slate-200 dark:border-slate-800` borders, `text-slate-900 dark:text-slate-100` headings.

---

## What is NOT changing

- `ProjectCommandCenter.tsx` — untouched
- `AiSettingsPage.tsx` — untouched
- `NewProjectChat.tsx` — untouched
- `/activity` page — untouched
- All backend endpoints — untouched
