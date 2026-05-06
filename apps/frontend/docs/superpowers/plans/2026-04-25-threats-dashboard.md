# Threats Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 1406-line `ThreatsDashboardPage` monolith with a focused dashboard + a new full-page threat detail route, using shared UI primitives from `feat/ux-foundations` and chrome conventions from `feat/ux-diagram-chrome`.

**Architecture:** Decompose the monolith into focused per-component files under `components/threats/`. The dashboard becomes a slim orchestrator that owns URL-synced filter state, renders the heatmap + Filters popover + active-filter chip row + table, and routes row clicks to a new `/projects/:projectId/threats/:threatId` detail page. The detail page absorbs the former sidesheet body. Shared label maps move to `lib/threatBadges.ts`. New `lib/api.ts` helper `apiGetThreat` hits a backend endpoint that ships in `layers-rest` separately.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS v3 (`darkMode: 'class'`), `lucide-react`, `react-markdown` + `remark-gfm`. Shared primitives: `Button`, `IconButton`, `Tooltip`, `EmptyState`, `StatusPill`, `ClickToEditPill`, `DropdownMenu`, `SeverityStripeRow`.

**Branch:** `feat/threats-dashboard-redesign` (already created, holds the design spec at `f013bba`).

**Backend dependency:** A new endpoint `GET /api/projects/:projectId/threats/:threatId` is required for the detail page to load via direct URL. Task 0 below specifies the backend implementation in the `layers-rest` repo with explicit IDOR / BOLA protections. Frontend Task 2 then adds the typed client. If Task 0 is shipped on a separate branch in `layers-rest`, dispatch its subagent against that repo's working directory.

**Quality gates per task:**
- `npx tsc --noEmit` → 0 errors
- `npm run build` → "Compiled successfully"
- **Do NOT** run `npm run lint` — pre-existing broken in Next 16 at the repo level.
- Manual: every visible surface verified in both light and dark mode where applicable.

---

## Task 0: Backend — `GET /projects/:projectId/threats/:threatId` with IDOR / BOLA protection

**Repo:** `layers-rest` (working dir `/Users/sunil/Development/github/layers-rest`)

**Files:**
- Modify: `src/threat/threat.controller.ts`
- Modify: `src/threat/threat.service.ts`

**Context:** Existing threat handlers use `@UseGuards(JwtAuthGuard)`, `@Param(..., ParseUUIDPipe)`, `@CurrentUser('id') userId`, and a service-side `verifyProjectOwnership(projectId, userId)` helper. Some older handlers (`updateThreat`, `deleteThreat`) `findUnique` then check `project.ownerId !== userId` and throw `ForbiddenException` — that pattern leaks existence and is **not** the pattern this task uses. This task uses a joined Prisma `where` plus uniform `NotFoundException`. See spec §7.1 for the full security rationale and required test cases.

- [ ] **Step 1: Add the controller route**

In `src/threat/threat.controller.ts`, add a new handler in the same group as `listProjectThreats` (around line 72):

```ts
@Get('projects/:projectId/threats/:threatId')
getProjectThreat(
  @Param('projectId', ParseUUIDPipe) projectId: string,
  @Param('threatId', ParseUUIDPipe) threatId: string,
  @CurrentUser('id') userId: string,
): Promise<ProjectThreatResponse> {
  return this.threat.getProjectThreat(projectId, threatId, userId);
}
```

`ProjectThreatResponse` is the existing shape returned by `listProjectThreats` for individual rows. If a named type does not exist yet, use the inferred return type of `threat.service.ts → listProjectThreats`'s `data[number]` and add an explicit type alias if helpful.

- [ ] **Step 2: Add the service method with the joined-where pattern**

In `src/threat/threat.service.ts`, add:

```ts
async getProjectThreat(projectId: string, threatId: string, userId: string) {
  const threat = await this.prisma.threat.findFirst({
    where: {
      id: threatId,
      threatModel: {
        projectId,
        project: { ownerId: userId },
      },
    },
    include: {
      threatModel: {
        include: {
          project: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!threat) throw new NotFoundException('Threat not found');
  return threat;
}
```

**Do NOT** use `findUnique` + `if (project.ownerId !== userId) throw ForbiddenException`. The query itself must enforce ownership. A miss for any reason (does not exist, wrong project, wrong owner) returns 404 — never 403 — to prevent enumeration of valid IDs across tenants.

If the response shape needs to mirror `listProjectThreats` row shape exactly (for the frontend `ProjectThreat` type to deserialize cleanly), adjust the `include` clause to match what that handler returns. Match field-by-field; do not reinvent.

- [ ] **Step 3: Verify type check + build**

From `/Users/sunil/Development/github/layers-rest`:

```bash
npx tsc --noEmit
```

Expected: exit 0.

```bash
npm run build
```

Expected: build success.

- [ ] **Step 4: Manual security verification (smoke)**

Spin up the backend (`npm run start:dev`) and run these six checks against a logged-in test user. Use `curl -H "Authorization: Bearer $TOKEN"`:

| Case | Setup | Request | Expect |
|------|-------|---------|--------|
| A | User owns P1, P1 has T1 | `GET /api/projects/P1/threats/T1` | 200 + threat body |
| B | User owns P1; another user owns P2/T2 | `GET /api/projects/P1/threats/T2` | 404 |
| C | User owns nothing | `GET /api/projects/P1/threats/T1` | 404 |
| D | No `Authorization` header | `GET /api/projects/P1/threats/T1` | 401 |
| E | Non-UUID id | `GET /api/projects/foo/threats/bar` | 400 |
| F | `T1` exists but is on P2, user owns P1 | `GET /api/projects/P1/threats/T1` | 404 |

Cases B, C, F all returning 404 (not 403, not 200) confirms the IDOR/BOLA defense holds.

- [ ] **Step 5: Commit**

From `/Users/sunil/Development/github/layers-rest`:

```bash
git add src/threat/threat.controller.ts src/threat/threat.service.ts
git commit -m "feat(threat): add GET project threat endpoint with IDOR/BOLA protection"
```

- [ ] **Step 6: Push + open PR (after this task)**

`git push -u origin <branch>` and open PR. Frontend Task 2 below depends on this shipping. The frontend can be developed in parallel against a stub but should not be merged until Task 0 is live.

---

## Task 1: Extract shared label maps to `lib/threatBadges.ts`

**Files:**
- Create: `lib/threatBadges.ts`
- Modify: `components/ThreatsDashboardPage.tsx` (remove the inline definitions migrating out)

**Context:** The monolith carries six near-duplicate label/style maps inline (`SEVERITY_BADGE`, `STATUS_BADGE`, `STRIDE_LABEL`, `STRIDE_FULL_LABEL`, `STRIDE_BADGE_CLS`, `SEVERITY_COLOR_RGB`, `SEV_SHORT`, plus `STATUS_OPTIONS`, `SEVERITY_OPTIONS`, `STRIDE_OPTIONS` arrays and a `formatDate` helper). Multiple new files will need them. Centralize.

- [ ] **Step 1: Create `lib/threatBadges.ts` with the consolidated maps**

```ts
import type { ThreatSeverity, ThreatStatus, StrideCategory } from '@/lib/api';

export const SEVERITY_OPTIONS: ThreatSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
export const STATUS_OPTIONS: ThreatStatus[] = ['IDENTIFIED', 'IN_PROGRESS', 'MITIGATED', 'ACCEPTED', 'FALSE_POSITIVE'];
export const STRIDE_OPTIONS: StrideCategory[] = [
  'SPOOFING', 'TAMPERING', 'REPUDIATION',
  'INFORMATION_DISCLOSURE', 'DENIAL_OF_SERVICE', 'ELEVATION_OF_PRIVILEGE',
];

export const STRIDE_LABEL: Record<StrideCategory, string> = {
  SPOOFING:               'Spoofing',
  TAMPERING:              'Tampering',
  REPUDIATION:            'Repudiation',
  INFORMATION_DISCLOSURE: 'Info Disclosure',
  DENIAL_OF_SERVICE:      'Denial of Service',
  ELEVATION_OF_PRIVILEGE: 'Elevation of Priv.',
};

export const STRIDE_FULL_LABEL: Record<StrideCategory, string> = {
  SPOOFING:               'Spoofing',
  TAMPERING:              'Tampering',
  REPUDIATION:            'Repudiation',
  INFORMATION_DISCLOSURE: 'Information Disclosure',
  DENIAL_OF_SERVICE:      'Denial of Service',
  ELEVATION_OF_PRIVILEGE: 'Elevation of Privilege',
};

export const STATUS_LABEL: Record<ThreatStatus, string> = {
  IDENTIFIED:    'Identified',
  IN_PROGRESS:   'In Progress',
  MITIGATED:     'Mitigated',
  ACCEPTED:      'Accepted',
  FALSE_POSITIVE:'Dismissed',
};

export const SEV_SHORT: Record<ThreatSeverity, string> = {
  CRITICAL: 'CRIT', HIGH: 'HIGH', MEDIUM: 'MED', LOW: 'LOW', INFO: 'INFO',
};

// RGB triples for heatmap cell backgrounds (dynamic alpha applied at render).
export const SEVERITY_COLOR_RGB: Record<ThreatSeverity, string> = {
  CRITICAL: '220, 38, 38',
  HIGH:     '234, 88, 12',
  MEDIUM:   '202, 138, 4',
  LOW:      '22, 163, 74',
  INFO:     '100, 116, 139',
};

export function formatThreatDate(iso: string): string {
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
```

- [ ] **Step 2: Remove the now-duplicated definitions from `ThreatsDashboardPage.tsx`**

Open `components/ThreatsDashboardPage.tsx`. Delete the inline definitions of `SEVERITY_OPTIONS`, `STATUS_OPTIONS`, `STRIDE_OPTIONS`, `STRIDE_LABEL`, `STRIDE_FULL_LABEL`, `STRIDE_BADGE_CLS`, `SEVERITY_COLOR_RGB`, `SEV_SHORT`, `STATUS_BADGE` (its `label` field becomes `STATUS_LABEL`), and the local `formatDate` function (rename usages to `formatThreatDate`). Replace each with an import from `@/lib/threatBadges`. The hand-rolled tailwind class maps `SEVERITY_BADGE`, `STATUS_BADGE.cls`, and `STRIDE_BADGE_CLS` are dropped — they will be replaced by `StatusPill` primitive usage in later tasks. For now, leave any remaining usages compiling by inlining minimal class strings where the monolith still uses them; these sites are all rewritten in Tasks 6, 7, 8 and disappear.

To minimize churn while still compiling, keep the file building by replacing each usage of the dropped maps with a temporary inline string. Example: `SEVERITY_BADGE[sev]` becomes the same string literal it would have produced. This is intentional throwaway — the next tasks delete these sites entirely.

- [ ] **Step 3: Verify type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: "Compiled successfully"

- [ ] **Step 5: Commit**

```bash
git add lib/threatBadges.ts components/ThreatsDashboardPage.tsx
git commit -m "refactor(threats): extract shared badge/label maps to lib/threatBadges"
```

---

## Task 2: Add `apiGetThreat` client + types

**Files:**
- Modify: `lib/api.ts` (append a single function near other threat helpers)

**Context:** The detail page (Task 8) needs to fetch a single threat by ID for direct-URL loads. Backend endpoint ships separately in `layers-rest`. Add the typed client now so subsequent tasks can import it.

- [ ] **Step 1: Append `apiGetThreat` to `lib/api.ts`**

Locate the existing `apiListProjectThreats` function near line 625. Immediately below `apiExportThreatReport`, add:

```ts
/** Fetch a single threat by id for the detail page. */
export function apiGetThreat(projectId: string, threatId: string): Promise<ProjectThreat> {
  return apiFetch<ProjectThreat>(`/api/projects/${projectId}/threats/${threatId}`);
}
```

`ProjectThreat` is already exported above; no new types needed.

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: "Compiled successfully"

- [ ] **Step 4: Commit**

```bash
git add lib/api.ts
git commit -m "feat(api): add apiGetThreat client for detail page"
```

---

## Task 3: Extract `StrideHeatMap` to its own file (no behavior change)

**Files:**
- Create: `components/threats/StrideHeatMap.tsx`
- Modify: `components/ThreatsDashboardPage.tsx` (delete the inline component, import the new file)

**Context:** The heatmap is ~120 lines inside the monolith. Move it as-is, swapping the inline label-map references for imports from `lib/threatBadges`.

- [ ] **Step 1: Create `components/threats/StrideHeatMap.tsx`**

```tsx
'use client';

import { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { ProjectThreat, StrideCategory, ThreatSeverity } from '@/lib/api';
import {
  STRIDE_OPTIONS, STRIDE_LABEL, SEVERITY_OPTIONS, SEVERITY_COLOR_RGB, SEV_SHORT,
} from '@/lib/threatBadges';

export interface StrideHeatMapProps {
  threats: ProjectThreat[];
  activeStride: StrideCategory | 'ALL';
  activeSeverity: ThreatSeverity | 'ALL';
  onCellClick: (stride: StrideCategory, sev: ThreatSeverity) => void;
}

export function StrideHeatMap({ threats, activeStride, activeSeverity, onCellClick }: StrideHeatMapProps) {
  const matrix = useMemo(() => {
    const counts: Partial<Record<StrideCategory, Partial<Record<ThreatSeverity, number>>>> = {};
    for (const t of threats) {
      if (t.status === 'FALSE_POSITIVE') continue;
      if (!counts[t.strideCategory]) counts[t.strideCategory] = {};
      counts[t.strideCategory]![t.severity] = (counts[t.strideCategory]![t.severity] ?? 0) + 1;
    }
    return counts;
  }, [threats]);

  const maxCount = useMemo(() => {
    let max = 1;
    for (const s of STRIDE_OPTIONS)
      for (const v of SEVERITY_OPTIONS) {
        const c = matrix[s]?.[v] ?? 0;
        if (c > max) max = c;
      }
    return max;
  }, [matrix]);

  const totalShown = useMemo(
    () => threats.filter((t) => t.status !== 'FALSE_POSITIVE').length,
    [threats],
  );

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck size={13} className="text-red-500 flex-shrink-0" />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">STRIDE Risk Matrix</span>
        <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">
          {totalShown} active · click to filter
        </span>
      </div>

      <div className="mb-1 grid grid-cols-[100px_repeat(5,1fr)] gap-1">
        <div />
        {SEVERITY_OPTIONS.map((sev) => (
          <div key={sev} className={`text-center text-[10px] font-bold uppercase tracking-wide ${
            sev === 'CRITICAL' ? 'text-red-600 dark:text-red-400' :
            sev === 'HIGH'     ? 'text-orange-500 dark:text-orange-400' :
            sev === 'MEDIUM'   ? 'text-yellow-600 dark:text-yellow-400' :
            sev === 'LOW'      ? 'text-green-600 dark:text-green-400' :
                                 'text-slate-500 dark:text-slate-400'
          }`}>
            {SEV_SHORT[sev]}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {STRIDE_OPTIONS.map((stride) => (
          <div key={stride} className="grid grid-cols-[100px_repeat(5,1fr)] gap-1 items-center">
            <div className="truncate pr-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
              {STRIDE_LABEL[stride]}
            </div>
            {SEVERITY_OPTIONS.map((sev) => {
              const count = matrix[stride]?.[sev] ?? 0;
              const isActive = activeStride === stride && activeSeverity === sev;
              const opacity = count === 0 ? 0 : Math.min(0.12 + (count / maxCount) * 0.78, 0.9);
              const textDark = opacity > 0.45;
              return (
                <button
                  key={sev}
                  disabled={count === 0}
                  onClick={() => onCellClick(stride, sev)}
                  title={count > 0 ? `${count} ${STRIDE_LABEL[stride]} / ${sev}` : undefined}
                  style={count > 0 ? { backgroundColor: `rgba(${SEVERITY_COLOR_RGB[sev]}, ${opacity})` } : undefined}
                  className={`flex h-8 items-center justify-center rounded text-xs font-bold tabular-nums transition-all ${
                    count === 0
                      ? 'cursor-default border border-dashed border-slate-200 text-slate-300 dark:border-slate-700 dark:text-slate-700'
                      : isActive
                        ? 'cursor-pointer shadow ring-2 ring-inset ring-slate-700 dark:ring-slate-200'
                        : 'cursor-pointer hover:ring-2 hover:ring-inset hover:ring-slate-400 hover:shadow'
                  }`}
                >
                  {count > 0
                    ? <span className={textDark ? 'text-white' : 'text-slate-800 dark:text-slate-200'}>{count}</span>
                    : <span>—</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {(activeStride !== 'ALL' || activeSeverity !== 'ALL') && (
        <p className="mt-3 text-center text-[10px] text-blue-500 dark:text-blue-400">
          Filtering: {activeSeverity !== 'ALL' ? activeSeverity : 'all'} × {activeStride !== 'ALL' ? STRIDE_LABEL[activeStride] : 'all STRIDE'}
          {' · '}
          <button
            onClick={() => { onCellClick(activeStride as StrideCategory, activeSeverity as ThreatSeverity); }}
            className="underline hover:no-underline"
          >
            clear
          </button>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Delete the inline `StrideHeatMap` from `ThreatsDashboardPage.tsx` and import the new one**

In `components/ThreatsDashboardPage.tsx`, remove the local `function StrideHeatMap(...)` (and the local `HeatMapProps` interface). Add to the imports:

```tsx
import { StrideHeatMap } from '@/components/threats/StrideHeatMap';
```

Existing usage `<StrideHeatMap … />` continues to compile.

- [ ] **Step 3: Verify type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: "Compiled successfully"

- [ ] **Step 5: Commit**

```bash
git add components/threats/StrideHeatMap.tsx components/ThreatsDashboardPage.tsx
git commit -m "refactor(threats): extract StrideHeatMap to its own file"
```

---

## Task 4: Extract `AddThreatModal` to its own file (no behavior change)

**Files:**
- Create: `components/threats/AddThreatModal.tsx`
- Modify: `components/ThreatsDashboardPage.tsx` (delete the inline component, import the new file)

**Context:** The Add Threat modal is ~150 lines inline. Move it as-is.

- [ ] **Step 1: Create `components/threats/AddThreatModal.tsx`**

Copy the entire `function AddThreatModal({ models, onClose, onCreated }: AddThreatModalProps) { … }` block from `ThreatsDashboardPage.tsx` (around lines 735–880), plus its `AddThreatModalProps` interface. Convert it to a default `export function AddThreatModal`. Replace its inline label-map usages with imports from `@/lib/threatBadges` (`SEVERITY_OPTIONS`, `STRIDE_OPTIONS`, `STRIDE_LABEL`, `STATUS_LABEL`).

```tsx
'use client';

// (… imports as needed …)
import { SEVERITY_OPTIONS, STRIDE_OPTIONS, STRIDE_LABEL } from '@/lib/threatBadges';
import { apiCreateThreat, type ThreatModelSummary } from '@/lib/api';

export interface AddThreatModalProps {
  projectId: string;
  models: ThreatModelSummary[];
  onClose: () => void;
  onCreated: () => void;
}

export function AddThreatModal({ projectId, models, onClose, onCreated }: AddThreatModalProps) {
  // body copied verbatim from the existing inline definition
}
```

The exact body is copied verbatim from the current inline implementation. Do not change behavior, validation, error handling, or styling.

- [ ] **Step 2: Delete the inline `AddThreatModal` from `ThreatsDashboardPage.tsx` and import the new one**

```tsx
import { AddThreatModal } from '@/components/threats/AddThreatModal';
```

Existing usage `{showAddModal && <AddThreatModal … />}` continues to compile (props match).

- [ ] **Step 3: Verify type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: "Compiled successfully"

- [ ] **Step 5: Commit**

```bash
git add components/threats/AddThreatModal.tsx components/ThreatsDashboardPage.tsx
git commit -m "refactor(threats): extract AddThreatModal to its own file"
```

---

## Task 5: Build `FiltersPopover` + `ActiveFilterChips`

**Files:**
- Create: `components/threats/FiltersPopover.tsx`
- Create: `components/threats/ActiveFilterChips.tsx`

**Context:** Replace the three inline `<select>` elements with one `Filters ▾` popover + a separate active-filter chip row. Spec §5. The popover uses three `DropdownMenu` instances (severity / status / STRIDE) plus "Clear all" / "Done". The chip row renders one chip per non-ALL filter; clicking ✕ resets that single filter.

- [ ] **Step 1: Create `components/threats/FiltersPopover.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { Button } from '@/components/ui/Button';
import type { ThreatSeverity, ThreatStatus, StrideCategory } from '@/lib/api';
import {
  SEVERITY_OPTIONS, STATUS_OPTIONS, STRIDE_OPTIONS,
  STATUS_LABEL, STRIDE_LABEL,
} from '@/lib/threatBadges';

export interface FiltersPopoverProps {
  severity: ThreatSeverity | 'ALL';
  status: ThreatStatus | 'ALL';
  stride: StrideCategory | 'ALL';
  onChange: (next: { severity: ThreatSeverity | 'ALL'; status: ThreatStatus | 'ALL'; stride: StrideCategory | 'ALL' }) => void;
}

export function FiltersPopover({ severity, status, stride, onChange }: FiltersPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeCount =
    (severity !== 'ALL' ? 1 : 0) + (status !== 'ALL' ? 1 : 0) + (stride !== 'ALL' ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const set = (patch: Partial<{ severity: ThreatSeverity | 'ALL'; status: ThreatStatus | 'ALL'; stride: StrideCategory | 'ALL' }>) => {
    onChange({ severity, status, stride, ...patch });
  };

  const triggerActive = activeCount > 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
          triggerActive
            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        <Filter size={13} />
        <span>Filters</span>
        {triggerActive && (
          <span className="rounded-full bg-blue-500 px-1.5 text-[10px] font-bold text-white">{activeCount}</span>
        )}
        <ChevronDown size={11} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <FilterRow label="Severity">
            <DropdownMenu
              trigger={<TriggerLabel value={severity === 'ALL' ? 'All severities' : severity} />}
              items={[
                { value: 'ALL', label: 'All severities', onSelect: () => set({ severity: 'ALL' }) },
                ...SEVERITY_OPTIONS.map((s) => ({ value: s, label: s, onSelect: () => set({ severity: s }) })),
              ]}
            />
          </FilterRow>

          <FilterRow label="Status">
            <DropdownMenu
              trigger={<TriggerLabel value={status === 'ALL' ? 'All statuses' : STATUS_LABEL[status]} />}
              items={[
                { value: 'ALL', label: 'All statuses', onSelect: () => set({ status: 'ALL' }) },
                ...STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s], onSelect: () => set({ status: s }) })),
              ]}
            />
          </FilterRow>

          <FilterRow label="STRIDE">
            <DropdownMenu
              trigger={<TriggerLabel value={stride === 'ALL' ? 'All STRIDE' : STRIDE_LABEL[stride]} />}
              items={[
                { value: 'ALL', label: 'All STRIDE', onSelect: () => set({ stride: 'ALL' }) },
                ...STRIDE_OPTIONS.map((s) => ({ value: s, label: STRIDE_LABEL[s], onSelect: () => set({ stride: s }) })),
              ]}
            />
          </FilterRow>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onChange({ severity: 'ALL', status: 'ALL', stride: 'ALL' })}
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Clear all
            </button>
            <Button variant="primary" onClick={() => setOpen(false)} className="h-7 px-3 py-0 text-xs">
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </div>
  );
}

function TriggerLabel({ value }: { value: string }) {
  return (
    <button
      type="button"
      className="flex h-7 min-w-[120px] items-center justify-between gap-1 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      <span className="truncate">{value}</span>
      <ChevronDown size={10} />
    </button>
  );
}
```

- [ ] **Step 2: Create `components/threats/ActiveFilterChips.tsx`**

```tsx
'use client';

import { X } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import type { ThreatSeverity, ThreatStatus, StrideCategory } from '@/lib/api';
import { STATUS_LABEL, STRIDE_LABEL } from '@/lib/threatBadges';

export interface ActiveFilterChipsProps {
  severity: ThreatSeverity | 'ALL';
  status: ThreatStatus | 'ALL';
  stride: StrideCategory | 'ALL';
  onChange: (next: { severity?: ThreatSeverity | 'ALL'; status?: ThreatStatus | 'ALL'; stride?: StrideCategory | 'ALL' }) => void;
}

export function ActiveFilterChips({ severity, status, stride, onChange }: ActiveFilterChipsProps) {
  const hasAny = severity !== 'ALL' || status !== 'ALL' || stride !== 'ALL';
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {severity !== 'ALL' && (
        <Chip label={`Severity: ${severity}`} onClear={() => onChange({ severity: 'ALL' })}>
          <StatusPill variant="severity" value={severity.toLowerCase() as Lowercase<ThreatSeverity>} />
        </Chip>
      )}
      {stride !== 'ALL' && (
        <Chip label={`STRIDE: ${STRIDE_LABEL[stride]}`} onClear={() => onChange({ stride: 'ALL' })} />
      )}
      {status !== 'ALL' && (
        <Chip label={`Status: ${STATUS_LABEL[status]}`} onClear={() => onChange({ status: 'ALL' })} />
      )}
      <button
        type="button"
        onClick={() => onChange({ severity: 'ALL', status: 'ALL', stride: 'ALL' })}
        className="text-xs text-blue-500 underline hover:text-blue-700 dark:hover:text-blue-300"
      >
        Clear all
      </button>
    </div>
  );
}

function Chip({ label, onClear, children }: { label: string; onClear: () => void; children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {children ?? label}
      {!children && <span className="sr-only">{label}</span>}
      {children && <span className="text-slate-500 dark:text-slate-400">{label.split(': ')[1]}</span>}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${label}`}
        className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
      >
        <X size={10} />
      </button>
    </span>
  );
}
```

If `StatusPill` doesn't accept the lowercase severity values listed above, fall back to a plain text chip (drop the StatusPill, render `label` directly). Verify by reading `components/ui/StatusPill.tsx`.

- [ ] **Step 3: Verify type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: "Compiled successfully"

- [ ] **Step 5: Commit**

```bash
git add components/threats/FiltersPopover.tsx components/threats/ActiveFilterChips.tsx
git commit -m "feat(threats): add FiltersPopover and ActiveFilterChips primitives"
```

---

## Task 6: Build `ThreatsTable`

**Files:**
- Create: `components/threats/ThreatsTable.tsx`

**Context:** Owns the table rendering. Each row click navigates to the detail page via `router.push`. Status cell uses `ClickToEditPill` and stops propagation so the click does not navigate. Severity / STRIDE / Source rendered with `StatusPill`. Description preview shown below the title (comfortable density per spec §6). Drops the "Model" column.

- [ ] **Step 1: Create `components/threats/ThreatsTable.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { StatusPill } from '@/components/ui/StatusPill';
import { ClickToEditPill } from '@/components/ui/ClickToEditPill';
import type { ProjectThreat, ThreatStatus } from '@/lib/api';
import { STATUS_OPTIONS, STATUS_LABEL, STRIDE_LABEL, formatThreatDate } from '@/lib/threatBadges';
import { apiUpdateThreat } from '@/lib/api';

export interface ThreatsTableProps {
  projectId: string;
  threats: ProjectThreat[];
  loading: boolean;
  onStatusChanged: (id: string, next: ProjectThreat) => void;
}

export function ThreatsTable({ projectId, threats, loading, onStatusChanged }: ThreatsTableProps) {
  const router = useRouter();

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40">
            <Th>Threat</Th>
            <Th hidden="sm">Target</Th>
            <Th>Severity</Th>
            <Th hidden="md">STRIDE</Th>
            <Th>Status</Th>
            <Th hidden="lg">Layer</Th>
            <Th hidden="xl">Source</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {threats.map((t) => {
            const isDismissed = t.status === 'FALSE_POSITIVE';
            return (
              <tr
                key={t.id}
                onClick={() => router.push(`/projects/${projectId}/threats/${t.id}`)}
                className={`group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30 ${isDismissed ? 'opacity-50' : ''}`}
              >
                <td className="max-w-[280px] py-3 pl-4 pr-4">
                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{t.title}</div>
                  <div className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">{t.description}</div>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{t.targetLabel}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusPill variant="severity" value={t.severity.toLowerCase() as 'critical' | 'high' | 'medium' | 'low' | 'info'} />
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <StatusPill variant="stride" value={strideToVariantValue(t.strideCategory)} />
                </td>
                <td
                  className="px-4 py-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ClickToEditPill
                    variant="status"
                    value={statusToVariantValue(t.status)}
                    options={STATUS_OPTIONS.map((s) => statusToVariantValue(s))}
                    onChange={async (nextValue) => {
                      const nextStatus = variantValueToStatus(nextValue);
                      const updated = await apiUpdateThreat(t.threatModel.id, t.id, { status: nextStatus });
                      onStatusChanged(t.id, { ...t, ...updated });
                    }}
                  />
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t.layerName ?? 'root'}</span>
                </td>
                <td className="hidden px-4 py-3 xl:table-cell">
                  <StatusPill variant="source" value={t.identifiedBy === 'AI' ? 'ai' : 'user'} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, hidden }: { children: React.ReactNode; hidden?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const hideCls = hidden ? `hidden ${hidden}:table-cell` : '';
  return (
    <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${hideCls}`}>
      {children}
    </th>
  );
}

// StatusPill `stride` variant uses lowercase hyphenated keys; map our enum to those.
function strideToVariantValue(s: import('@/lib/api').StrideCategory): 'spoofing' | 'tampering' | 'repudiation' | 'info-disclosure' | 'dos' | 'elevation' {
  switch (s) {
    case 'SPOOFING': return 'spoofing';
    case 'TAMPERING': return 'tampering';
    case 'REPUDIATION': return 'repudiation';
    case 'INFORMATION_DISCLOSURE': return 'info-disclosure';
    case 'DENIAL_OF_SERVICE': return 'dos';
    case 'ELEVATION_OF_PRIVILEGE': return 'elevation';
  }
}

// StatusPill `status` variant uses dashed lowercase keys; map enum.
function statusToVariantValue(s: ThreatStatus): 'open' | 'in-review' | 'mitigated' | 'dismissed' | 'accepted' {
  switch (s) {
    case 'IDENTIFIED': return 'open';
    case 'IN_PROGRESS': return 'in-review';
    case 'MITIGATED': return 'mitigated';
    case 'ACCEPTED': return 'accepted';
    case 'FALSE_POSITIVE': return 'dismissed';
  }
}

function variantValueToStatus(v: string): ThreatStatus {
  switch (v) {
    case 'open': return 'IDENTIFIED';
    case 'in-review': return 'IN_PROGRESS';
    case 'mitigated': return 'MITIGATED';
    case 'accepted': return 'ACCEPTED';
    case 'dismissed': return 'FALSE_POSITIVE';
    default: return 'IDENTIFIED';
  }
}
```

`formatThreatDate` is imported but not used in this file directly — the linter ignores it. If TypeScript complains about unused import, drop the import.

`ProjectThreat.layerName` may not exist on the current type. If `tsc` complains, replace `t.layerName ?? 'root'` with `t.threatModel?.name ?? 'root'` or remove the Layer column entirely; verify by reading `lib/api.ts → ProjectThreat`.

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: "Compiled successfully"

- [ ] **Step 4: Commit**

```bash
git add components/threats/ThreatsTable.tsx
git commit -m "feat(threats): add ThreatsTable with row-click nav and inline status edit"
```

---

## Task 7: Rebuild `ThreatsDashboardPage`

**Files:**
- Modify (rewrite): `components/ThreatsDashboardPage.tsx`

**Context:** The orchestrator. Owns URL-synced filter state, debounced fetch, modals. Drops the four summary cards. Wires `StrideHeatMap` + `FiltersPopover` + `ActiveFilterChips` + `ThreatsTable`. Top bar follows the secondary-page chrome convention from `CLAUDE.md`. Pagination uses neutral slate (no red).

- [ ] **Step 1: Replace the whole file with the new orchestrator**

Wholesale rewrite. The file becomes ~250 lines. Below is the full content:

```tsx
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck, ArrowLeft, Loader2, AlertCircle, Search, Plus,
  Sun, Moon, Monitor, LogOut, User, FileText,
} from 'lucide-react';
import LayersLogo from '@/components/LayersLogo';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StrideHeatMap } from '@/components/threats/StrideHeatMap';
import { FiltersPopover } from '@/components/threats/FiltersPopover';
import { ActiveFilterChips } from '@/components/threats/ActiveFilterChips';
import { ThreatsTable } from '@/components/threats/ThreatsTable';
import { AddThreatModal } from '@/components/threats/AddThreatModal';
import {
  apiListProjectThreats, apiListThreatModels, apiGetProject, apiExportThreatReport,
  type ProjectThreat, type ThreatSeverity, type ThreatStatus, type StrideCategory,
  type ThreatModelSummary, type ThreatsDashboardResult,
} from '@/lib/api';
import { getStoredUser, signOut } from '@/lib/authStore';
import { useTheme } from '@/lib/themeContext';

interface Props { projectId: string }

export default function ThreatsDashboardPage({ projectId }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const { theme, cycleTheme } = useTheme();
  const storedUser = getStoredUser();

  // ── Filter state (URL synced) ───────────────────────────────────────────
  const [searchText, setSearchText] = useState(search.get('q') ?? '');
  const [filterSeverity, setFilterSeverity] = useState<ThreatSeverity | 'ALL'>((search.get('sev') as ThreatSeverity | null) ?? 'ALL');
  const [filterStatus, setFilterStatus] = useState<ThreatStatus | 'ALL'>((search.get('status') as ThreatStatus | null) ?? 'ALL');
  const [filterStride, setFilterStride] = useState<StrideCategory | 'ALL'>((search.get('stride') as StrideCategory | null) ?? 'ALL');
  const [page, setPage] = useState(() => Math.max(0, parseInt(search.get('page') ?? '1', 10) - 1));

  // ── Page data ───────────────────────────────────────────────────────────
  const [result, setResult] = useState<ThreatsDashboardResult | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threatModels, setThreatModels] = useState<ThreatModelSummary[]>([]);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);

  // ── Push URL on filter change (immediate) ───────────────────────────────
  useEffect(() => {
    const qs = new URLSearchParams();
    if (searchText) qs.set('q', searchText);
    if (filterSeverity !== 'ALL') qs.set('sev', filterSeverity);
    if (filterStatus !== 'ALL') qs.set('status', filterStatus);
    if (filterStride !== 'ALL') qs.set('stride', filterStride);
    if (page > 0) qs.set('page', String(page + 1));
    const next = qs.toString();
    router.replace(`/projects/${projectId}/threats${next ? `?${next}` : ''}`);
  }, [searchText, filterSeverity, filterStatus, filterStride, page, projectId, router]);

  // ── Debounced fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(async () => {
      setTableLoading(true);
      setError(null);
      try {
        const params: Parameters<typeof apiListProjectThreats>[1] = { page, limit: 20 };
        if (searchText) params.search = searchText;
        if (filterSeverity !== 'ALL') params.severity = filterSeverity;
        if (filterStatus !== 'ALL') params.status = filterStatus;
        if (filterStride !== 'ALL') params.strideCategory = filterStride;
        const r = await apiListProjectThreats(projectId, params);
        setResult(r);
      } catch (e) {
        setError((e as Error).message || 'Failed to load threats');
      } finally {
        setTableLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [projectId, searchText, filterSeverity, filterStatus, filterStride, page]);

  // ── One-shot loads ──────────────────────────────────────────────────────
  useEffect(() => {
    apiGetProject(projectId).then((p) => setProjectName(p.name)).catch(() => {});
    apiListThreatModels(projectId).then(setThreatModels).catch(() => {});
  }, [projectId]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const threats = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = result ? Math.max(1, Math.ceil(total / result.limit)) : 1;

  const heatMapThreats = useMemo(() => threats, [threats]); // backend already filters; keep as-is

  const handleHeatMapCellClick = useCallback((stride: StrideCategory, sev: ThreatSeverity) => {
    if (filterStride === stride && filterSeverity === sev) {
      setFilterStride('ALL');
      setFilterSeverity('ALL');
    } else {
      setFilterStride(stride);
      setFilterSeverity(sev);
    }
    setPage(0);
  }, [filterStride, filterSeverity]);

  const handleStatusChanged = useCallback((id: string, next: ProjectThreat) => {
    setResult((prev) => prev ? { ...prev, data: prev.data.map((t) => t.id === id ? next : t) } : prev);
  }, []);

  const handleFiltersChange = (patch: { severity?: ThreatSeverity | 'ALL'; status?: ThreatStatus | 'ALL'; stride?: StrideCategory | 'ALL' }) => {
    if (patch.severity !== undefined) setFilterSeverity(patch.severity);
    if (patch.status !== undefined) setFilterStatus(patch.status);
    if (patch.stride !== undefined) setFilterStride(patch.stride);
    setPage(0);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-gray-950">

      {/* ── Top bar (secondary-page convention) ─────────────────────────── */}
      <header className="flex h-9 flex-shrink-0 items-center border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="mr-4 flex items-center gap-1.5 pl-1">
          <LayersLogo size={14} className="text-blue-600" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Layers</span>
        </div>
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="flex items-center gap-1.5 rounded px-3 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <ArrowLeft size={13} />
          Back to diagram
        </button>
        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-red-500" />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {projectName ? `${projectName} — Threats` : 'Threats Dashboard'}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {threatModels.length > 0 && (
            <>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <Plus size={12} />
                Add Threat
              </button>
              <button
                onClick={async () => {
                  setExportingReport(true);
                  try { await apiExportThreatReport(projectId); }
                  finally { setExportingReport(false); }
                }}
                disabled={exportingReport}
                className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white disabled:opacity-50"
                title="Export as PDF report"
              >
                {exportingReport
                  ? <><Loader2 size={12} className="animate-spin" /> Generating…</>
                  : <><FileText size={12} /> Export Report</>}
              </button>
            </>
          )}
          <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <button
            onClick={cycleTheme}
            title={`Theme: ${theme} — click to cycle`}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            {theme === 'light' ? <Sun size={14} /> : theme === 'dark' ? <Moon size={14} /> : <Monitor size={14} />}
          </button>
          <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
          {storedUser && (
            <button
              onClick={() => { signOut(); router.push('/login'); }}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              title="Sign out"
            >
              <User size={13} className="text-slate-500 dark:text-slate-400" />
              <span className="max-w-[140px] truncate text-xs text-slate-500 dark:text-slate-400">{storedUser.email}</span>
              <LogOut size={12} className="text-slate-400 dark:text-slate-500" />
            </button>
          )}
        </div>
      </header>

      {/* ── Main scrollable area ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl space-y-5 px-6 py-6">

          {/* STRIDE Risk Matrix */}
          <StrideHeatMap
            threats={heatMapThreats}
            activeStride={filterStride}
            activeSeverity={filterSeverity}
            onCellClick={handleHeatMapCellClick}
          />

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
                placeholder="Search threats…"
                className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-sm text-slate-900 outline-none placeholder-slate-400 focus:ring-1 focus:ring-blue-400/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>
            <FiltersPopover
              severity={filterSeverity}
              status={filterStatus}
              stride={filterStride}
              onChange={(next) => { setFilterSeverity(next.severity); setFilterStatus(next.status); setFilterStride(next.stride); setPage(0); }}
            />
            <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              {tableLoading && <Loader2 size={11} className="animate-spin" />}
              {total} result{total !== 1 ? 's' : ''}
              {totalPages > 1 ? ` · page ${page + 1}/${totalPages}` : ''}
            </span>
          </div>

          {/* Active filter chips */}
          <ActiveFilterChips
            severity={filterSeverity}
            status={filterStatus}
            stride={filterStride}
            onChange={handleFiltersChange}
          />

          {/* Threats table */}
          {error ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-400">
              <AlertCircle size={14} /> {error}
            </div>
          ) : !result ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={24} className="animate-spin text-slate-400" />
            </div>
          ) : total === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={28} />}
              heading={threatModels.length === 0 ? 'No threats saved yet' : 'No threats match your filters'}
              subtext={threatModels.length === 0
                ? 'Run a threat analysis from the diagram view to populate this dashboard.'
                : 'Try adjusting or clearing your filters.'}
              cta={threatModels.length === 0 ? (
                <Button onClick={() => router.push(`/projects/${projectId}`)}>
                  <ArrowLeft size={13} /> Go to diagram
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => handleFiltersChange({ severity: 'ALL', status: 'ALL', stride: 'ALL' })}>
                  Clear filters
                </Button>
              )}
            />
          ) : (
            <>
              <ThreatsTable
                projectId={projectId}
                threats={threats}
                loading={tableLoading}
                onStatusChanged={handleStatusChanged}
              />

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0 || tableLoading}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-white transition disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    ← Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className={`h-7 w-7 rounded-md text-xs font-medium transition ${
                          i === page
                            ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-400 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-500'
                            : 'text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1 || tableLoading}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-white transition disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddThreatModal
          projectId={projectId}
          models={threatModels}
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setPage(0); setShowAddModal(false); }}
        />
      )}
    </div>
  );
}
```

If `useTheme()` from `@/lib/themeContext` doesn't expose `cycleTheme`, port the cycle logic from the previous implementation (cycle light → dark → system).

If `apiGetProject` returns a different shape than `{ name }`, adjust accordingly — verify against `lib/api.ts`.

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: "Compiled successfully"

- [ ] **Step 4: Manual verify**

Start the dev server (`npm run dev`), log in, and navigate to a project's `/threats` page. Verify: heatmap renders, search input updates URL, Filters popover opens with three dropdowns, choosing a value shows a chip in the chip row, clicking a heatmap cell adds two chips, clicking the same cell again clears them, table shows comfortable rows with description preview, row click navigates to `/threats/:id` (will 404 until detail page lands in Task 9 — acceptable for this task), pagination uses neutral slate styling, summary cards are gone. Test in both light and dark mode.

- [ ] **Step 5: Commit**

```bash
git add components/ThreatsDashboardPage.tsx
git commit -m "feat(threats): rebuild dashboard orchestrator with URL sync and chip filters"
```

---

## Task 8: Build `ThreatDetailPage`

**Files:**
- Create: `components/ThreatDetailPage.tsx`

**Context:** Absorbs the body of the former inline `ThreatDetailSidesheet` plus the markdown renderer block. New top bar for the detail page (Back to threats, threat title, status pill, Delete). Loads threat via `apiGetThreat`. On 404, renders `EmptyState` with "Back to threats" CTA.

- [ ] **Step 1: Create `components/ThreatDetailPage.tsx`**

The file is large (~400 lines). Copy the sidesheet body verbatim and reshape it into a page layout:

1. **State + handlers** — copy directly from `ThreatDetailSidesheet` in the old monolith:
   - `pendingNotes`, `savingField`, `notesSaved`, `acceptanceError`, `confirmDelete`, `deleting`
   - `aiText`, `aiLoading`, `aiError`, `aiCopied`, `aiAbortRef`, `notesRef`
   - The five effect hooks for hydrating state and abort handling
   - `handleStatusChange`, `handleSeverityChange`, `handleSaveNotes`, `handleDelete`, `handleGetAiAdvice`, `handleCopyAdvice`

2. **`mitigationMdComponents`** — copy the markdown renderer block verbatim from the top of the old monolith into this file.

3. **`STRIDE_FULL_LABEL`** — import from `@/lib/threatBadges` (do not re-declare).

4. **Top-level structure:**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, AlertCircle, ShieldCheck, Sparkles, Copy, Check,
  Sun, Moon, Monitor, LogOut, User, Trash2, X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import LayersLogo from '@/components/LayersLogo';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  apiGetThreat, apiUpdateThreat, apiDeleteThreat, apiChatAsk,
  type ProjectThreat, type ThreatSeverity, type ThreatStatus,
} from '@/lib/api';
import { STRIDE_FULL_LABEL, formatThreatDate } from '@/lib/threatBadges';
import { getStoredUser, signOut } from '@/lib/authStore';
import { useTheme } from '@/lib/themeContext';

interface Props { projectId: string; threatId: string }

export default function ThreatDetailPage({ projectId, threatId }: Props) {
  const router = useRouter();
  const { theme, cycleTheme } = useTheme();
  const storedUser = getStoredUser();

  const [threat, setThreat] = useState<ProjectThreat | null>(null);
  const [loadError, setLoadError] = useState<'404' | 'network' | null>(null);
  const [pendingNotes, setPendingNotes] = useState('');
  const [savingField, setSavingField] = useState<string | null>(null);
  const [notesSaved, setNotesSaved] = useState(false);
  const [acceptanceError, setAcceptanceError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiCopied, setAiCopied] = useState(false);
  const aiAbortRef = useRef(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLoadError(null);
    apiGetThreat(projectId, threatId)
      .then((t) => {
        setThreat(t);
        setPendingNotes(t.mitigationNotes ?? '');
        setAiText(t.mitigationAdvice ?? '');
      })
      .catch((e) => {
        const msg = (e as Error).message ?? '';
        if (msg.includes('404')) setLoadError('404');
        else setLoadError('network');
      });
  }, [projectId, threatId]);

  // Handlers — port from old ThreatDetailSidesheet (lines ~341–453 of the
  // pre-task ThreatsDashboardPage.tsx) with two substitutions:
  //   * onUpdate(...)  → setThreat((prev) => prev ? { ...prev, ...updated } : prev)
  //   * onDelete(id)   → router.push(`/projects/${projectId}/threats`)
  //
  // Concretely:
  const handleStatusChange = async (newStatus: ThreatStatus) => {
    if (!threat || threat.status === newStatus || savingField) return;
    if (newStatus === 'ACCEPTED' && !pendingNotes.trim()) {
      setAcceptanceError(true);
      notesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      notesRef.current?.focus();
      return;
    }
    setSavingField('status');
    try {
      const updated = await apiUpdateThreat(threat.threatModel.id, threat.id, { status: newStatus });
      setThreat({ ...threat, ...updated });
      if (newStatus !== 'ACCEPTED') setAcceptanceError(false);
    } finally { setSavingField(null); }
  };

  const handleSaveNotes = async () => {
    if (!threat) return;
    setSavingField('notes');
    try {
      const updated = await apiUpdateThreat(threat.threatModel.id, threat.id, { mitigationNotes: pendingNotes });
      setThreat({ ...threat, ...updated });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } finally { setSavingField(null); }
  };

  const handleDelete = async () => {
    if (!threat) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await apiDeleteThreat(threat.threatModel.id, threat.id);
      router.push(`/projects/${projectId}/threats`);
    } finally { setDeleting(false); }
  };

  const handleGetAiAdvice = async () => {
    if (!threat) return;
    setAiText('');
    setAiError('');
    setAiLoading(true);
    aiAbortRef.current = false;
    let streamed = '';
    try {
      await apiChatAsk(
        {
          message: `You are a security expert reviewing identified threats for a software system.\n\nProvide specific, actionable mitigation recommendations for this threat:\n\n**Title**: ${threat.title}\n**STRIDE Category**: ${STRIDE_FULL_LABEL[threat.strideCategory]}\n**Target Component**: ${threat.targetLabel}\n**Severity**: ${threat.severity}\n**Description**: ${threat.description}\n\nProvide:\n1. Concrete implementation controls (specific code patterns, libraries, or configuration steps)\n2. How to verify the mitigation is effective\n3. Relevant security standard controls this satisfies (e.g., OWASP, ISO 27001 A-controls, SOC2 CC)\n\nBe concise and developer-actionable. Avoid generic advice.`,
          projectId,
        },
        (chunk) => {
          if (aiAbortRef.current) return;
          streamed += chunk;
          setAiText((prev) => prev + chunk);
        },
      );
      if (!aiAbortRef.current && streamed.trim()) {
        try {
          const updated = await apiUpdateThreat(threat.threatModel.id, threat.id, { mitigationAdvice: streamed });
          setThreat({ ...threat, ...updated });
        } catch { /* persist failure non-fatal */ }
      }
    } catch (e) {
      if (!aiAbortRef.current) setAiError((e as Error).message || 'Failed to get AI advice');
    } finally {
      if (!aiAbortRef.current) setAiLoading(false);
    }
  };

  const handleCopyAdvice = async () => {
    if (!aiText) return;
    try {
      await navigator.clipboard.writeText(aiText);
      setAiCopied(true);
      setTimeout(() => setAiCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  if (loadError === '404') {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-gray-950">
        <DetailTopBar projectId={projectId} title="Threat not found" router={router} theme={theme} cycleTheme={cycleTheme} storedUser={storedUser} threat={null} onDelete={undefined} />
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-2xl px-6 py-16">
            <EmptyState
              icon={<AlertCircle size={28} />}
              heading="Threat not found"
              subtext="This threat may have been deleted or moved."
              cta={<Button onClick={() => router.push(`/projects/${projectId}/threats`)}><ArrowLeft size={13} /> Back to threats</Button>}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!threat) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 size={28} className="animate-spin text-slate-400" />
      </div>
    );
  }

  // (… render top bar, body sections (StatusPill row, title, target, mitigation,
  //    AI advice card, metadata) — see spec §4 …)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-gray-950">
      <DetailTopBar
        projectId={projectId}
        title={threat.title}
        router={router}
        theme={theme}
        cycleTheme={cycleTheme}
        storedUser={storedUser}
        threat={threat}
        onDelete={async () => {
          if (!confirmDelete) { setConfirmDelete(true); return; }
          setDeleting(true);
          try {
            await apiDeleteThreat(threat.threatModel.id, threat.id);
            router.push(`/projects/${projectId}/threats`);
          } finally { setDeleting(false); }
        }}
        confirmDelete={confirmDelete}
        deleting={deleting}
      />
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">

          {/* Pill row */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill variant="severity" value={threat.severity.toLowerCase() as 'critical' | 'high' | 'medium' | 'low' | 'info'} />
            <StatusPill variant="stride" value={mapStride(threat.strideCategory)} />
            <StatusPill variant="source" value={threat.identifiedBy === 'AI' ? 'ai' : 'user'} />
            <span className="text-xs text-slate-500 dark:text-slate-400">Layer · {threat.layerName ?? 'root'}</span>
          </div>

          {/* Title + description */}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{threat.title}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{threat.description}</p>
            {threat.status === 'ACCEPTED' && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/30 dark:text-amber-200">
                <AlertCircle size={12} /> Accepted — requires mitigation notes for audit
              </div>
            )}
          </div>

          {/* Target */}
          <Section title="Target">
            <span className="font-mono text-sm text-slate-700 dark:text-slate-300">{threat.targetLabel}</span>
          </Section>

          {/* Mitigation */}
          <Section title="Mitigation">
            <textarea
              ref={notesRef}
              value={pendingNotes}
              onChange={(e) => setPendingNotes(e.target.value)}
              placeholder="Document the mitigation steps taken or planned…"
              className={`w-full rounded-lg border bg-white p-3 text-sm text-slate-900 outline-none dark:bg-slate-800 dark:text-slate-100 ${
                acceptanceError ? 'border-amber-400 focus:border-amber-500' : 'border-slate-200 focus:border-blue-400 dark:border-slate-700'
              }`}
              rows={6}
            />
            {pendingNotes !== (threat.mitigationNotes ?? '') && (
              <div className="mt-2 flex items-center gap-2">
                <Button onClick={handleSaveNotes} disabled={savingField === 'notes'}>
                  {savingField === 'notes' ? <Loader2 size={13} className="animate-spin" /> : null} Save
                </Button>
                <Button variant="secondary" onClick={() => setPendingNotes(threat.mitigationNotes ?? '')}>Cancel</Button>
                {notesSaved && <span className="text-xs text-green-600 dark:text-green-400">Saved</span>}
              </div>
            )}
          </Section>

          {/* AI advice */}
          <Section
            title="AI Mitigation Advice"
            actions={
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={handleGetAiAdvice} disabled={aiLoading}>
                  {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {aiText ? 'Refresh' : 'Generate'}
                </Button>
                {aiText && (
                  <Button variant="secondary" onClick={handleCopyAdvice}>
                    {aiCopied ? <Check size={13} /> : <Copy size={13} />}
                    {aiCopied ? 'Copied' : 'Copy'}
                  </Button>
                )}
              </div>
            }
          >
            {aiError && <div className="text-sm text-red-600 dark:text-red-400">{aiError}</div>}
            {aiText
              ? <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><ReactMarkdown remarkPlugins={[remarkGfm]} components={mitigationMdComponents}>{aiText}</ReactMarkdown></div>
              : !aiLoading && <p className="text-sm text-slate-500 dark:text-slate-400">No AI advice yet — click Generate.</p>}
          </Section>

          {/* Metadata */}
          <Section title="Metadata">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
              <Meta label="Source" value={threat.identifiedBy === 'AI' ? 'AI' : 'User'} />
              <Meta label="Identified" value={formatThreatDate(threat.createdAt)} />
              <Meta label="Last updated" value={formatThreatDate(threat.updatedAt ?? threat.createdAt)} />
              <Meta label="Threat Model" value={threat.threatModel.name} />
            </dl>
          </Section>
        </div>
      </div>
    </div>
  );
}

// ── Helper components (same file) ──────────────────────────────────────────

function Section({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-medium text-slate-500 dark:text-slate-500">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

interface DetailTopBarProps {
  projectId: string;
  title: string;
  router: ReturnType<typeof useRouter>;
  theme: string;
  cycleTheme: () => void;
  storedUser: ReturnType<typeof getStoredUser>;
  threat: ProjectThreat | null;
  onDelete?: () => void;
  confirmDelete?: boolean;
  deleting?: boolean;
}

function DetailTopBar({ projectId, title, router, theme, cycleTheme, storedUser, threat, onDelete, confirmDelete, deleting }: DetailTopBarProps) {
  return (
    <header className="flex h-9 flex-shrink-0 items-center border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="mr-4 flex items-center gap-1.5 pl-1">
        <LayersLogo size={14} className="text-blue-600" />
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Layers</span>
      </div>
      <button
        onClick={() => router.push(`/projects/${projectId}/threats`)}
        className="flex items-center gap-1.5 rounded px-3 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
      >
        <ArrowLeft size={13} />
        Back to threats
      </button>
      <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
      <div className="flex items-center gap-1.5 min-w-0">
        <ShieldCheck size={12} className="text-red-500 flex-shrink-0" />
        <span className="truncate text-sm text-slate-600 dark:text-slate-300" title={title}>{title}</span>
      </div>
      <div className="ml-auto flex items-center gap-1">
        {threat && onDelete && (
          <button
            onClick={onDelete}
            disabled={deleting}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs disabled:opacity-50 ${
              confirmDelete
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
            }`}
            title={confirmDelete ? 'Click again to confirm' : 'Delete this threat'}
          >
            <Trash2 size={12} />
            {confirmDelete ? 'Confirm delete' : 'Delete'}
          </button>
        )}
        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
        <button
          onClick={cycleTheme}
          title={`Theme: ${theme} — click to cycle`}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          {theme === 'light' ? <Sun size={14} /> : theme === 'dark' ? <Moon size={14} /> : <Monitor size={14} />}
        </button>
        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
        {storedUser && (
          <button
            onClick={() => { signOut(); router.push('/login'); }}
            className="flex items-center gap-1.5 rounded px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
            title="Sign out"
          >
            <User size={13} className="text-slate-500 dark:text-slate-400" />
            <span className="max-w-[140px] truncate text-xs text-slate-500 dark:text-slate-400">{storedUser.email}</span>
            <LogOut size={12} className="text-slate-400 dark:text-slate-500" />
          </button>
        )}
      </div>
    </header>
  );
}

function mapStride(s: import('@/lib/api').StrideCategory): 'spoofing' | 'tampering' | 'repudiation' | 'info-disclosure' | 'dos' | 'elevation' {
  switch (s) {
    case 'SPOOFING': return 'spoofing';
    case 'TAMPERING': return 'tampering';
    case 'REPUDIATION': return 'repudiation';
    case 'INFORMATION_DISCLOSURE': return 'info-disclosure';
    case 'DENIAL_OF_SERVICE': return 'dos';
    case 'ELEVATION_OF_PRIVILEGE': return 'elevation';
  }
}

const mitigationMdComponents = {
  // Copy verbatim from the original lines 49–118 of ThreatsDashboardPage.tsx.
  // These are the markdown renderers used for the AI advice card.
};
```

Because this task ports a 430-line sidesheet, the implementer should: (a) read the existing `ThreatDetailSidesheet` start–end (lines 301–730 of the pre-task `ThreatsDashboardPage.tsx` at branch start), (b) reuse every handler verbatim, (c) reshape the visual frame from a fixed-position aside into a page layout, (d) put the markdown renderer block (`mitigationMdComponents`) inside this file (it has no other consumer post-migration). The "Severity dropdown" + "Status dropdown" controls move into the top bar as `StatusPill` + `ClickToEditPill` per spec §4.

When tsc reports unused imports from the removed monolith, prune them from the dashboard file. When tsc reports duplicate identifiers (e.g. a stale `mitigationMdComponents` left in `ThreatsDashboardPage.tsx` from Task 7), delete the duplicate from the dashboard.

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: "Compiled successfully"

- [ ] **Step 4: Commit**

```bash
git add components/ThreatDetailPage.tsx components/ThreatsDashboardPage.tsx
git commit -m "feat(threats): add ThreatDetailPage absorbing the former sidesheet"
```

---

## Task 9: Wire the detail-page route

**Files:**
- Create: `app/projects/[projectId]/threats/[threatId]/page.tsx`

**Context:** Next.js 16 App Router server component that hands the dynamic route params to the client `ThreatDetailPage`. Pattern matches existing `app/projects/[projectId]/ai-history/page.tsx` and `app/projects/[projectId]/threats/page.tsx`.

- [ ] **Step 1: Create the route file**

```tsx
// app/projects/[projectId]/threats/[threatId]/page.tsx
import ThreatDetailPage from '@/components/ThreatDetailPage';

interface PageProps {
  params: Promise<{ projectId: string; threatId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { projectId, threatId } = await params;
  return <ThreatDetailPage projectId={projectId} threatId={threatId} />;
}
```

If the existing threats route uses a non-Promise `params` shape (older Next conventions), match that shape instead. Verify by reading `app/projects/[projectId]/threats/page.tsx` first.

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: "Compiled successfully" — confirm `/projects/[projectId]/threats/[threatId]` appears in the route output.

- [ ] **Step 4: Manual verify**

Start dev server. Click a row in the dashboard table — should navigate to `/projects/:id/threats/:threatId` and load the detail page. Refreshing the page should re-load the same threat (if backend endpoint is live). Direct-URL deep-link should work. Verify status changes via the top-bar pill, mitigation save, AI advice fetch, and Delete (with confirm + redirect back to dashboard).

- [ ] **Step 5: Commit**

```bash
git add app/projects/[projectId]/threats/[threatId]/page.tsx
git commit -m "feat(threats): add /threats/[threatId] dynamic route"
```

---

## Final verification

After Task 9 lands:

- [ ] **Branch type check + build clean**

Run: `npx tsc --noEmit` → exit 0.
Run: `npm run build` → "Compiled successfully".

- [ ] **Manual smoke pass on every dashboard surface**

- Top bar matches secondary-page convention (h-9, Layers logo, Back, project name + " — Threats", Add / Export / theme / user)
- Heatmap full-width, click cell filters
- Search + Filters popover + count badge
- Active-filter chips appear and clear individually
- Comfortable table density with description preview
- Row click navigates to detail
- Pagination uses neutral slate styling (no red)
- EmptyState (no threats yet) and EmptyState (no matches) both render correctly with their CTAs

- [ ] **Manual smoke pass on detail page**

- Top bar (Back to threats, project name + threat title, status pill, Delete, theme, user)
- StatusPill row (severity / STRIDE / source / layer)
- Title + description
- Mitigation editor (click to edit, save/cancel)
- AI advice card (refresh, copy)
- Metadata strip
- 404 EmptyState renders for missing threats
- Status change persists; Delete confirms and redirects back

- [ ] **Light + dark mode verified on both pages.**

- [ ] **Push branch + open PR to main**

```bash
git push -u origin feat/threats-dashboard-redesign
gh pr create --title "feat: threats dashboard redesign" --body "$(cat <<'EOF'
## Summary
- Replace 1406-line ThreatsDashboardPage monolith with focused per-component files under components/threats/
- New full-page detail route /projects/:projectId/threats/:threatId (replaces inline sidesheet)
- Filters popover + active-filter chip row replaces 3 native selects + 4 summary cards
- Comfortable table density with description preview
- Shared label maps consolidated in lib/threatBadges.ts

## Backend dep
Requires GET /api/projects/:projectId/threats/:threatId in layers-rest. Track separately.

## Test plan
- [ ] Manual smoke on dashboard: heatmap, filters, chip row, table, pagination, empty states, light/dark
- [ ] Manual smoke on detail: load, status edit, mitigation save, AI advice, delete + redirect, light/dark
- [ ] Refresh deep-link to /threats/:id works (after backend ships)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of scope (deferred)

- Bulk actions (multi-select rows, bulk status change)
- CSV export of dashboard view
- Saved filter presets
- Activity log per threat
- Comments / collaboration
- Real-time updates via websocket
- Refactor of `mitigationMdComponents` markdown renderers
- Tests — no test infrastructure in this repo today
