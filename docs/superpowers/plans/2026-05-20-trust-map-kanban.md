# Trust Map (Kanban) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a read-only secondary page at `/projects/:projectId/trust-map` that renders project trust boundaries as kanban columns, contained nodes as cards, cross-boundary edges as SVG arrows over the columns, and a STRIDE analysis panel reusing saved threats. Clicking a card jumps to the canvas with the node selected.

**Architecture:** Pure aggregation in `lib/trustMap.ts` produces a `TrustMapView` from the project's `LayerMap` + saved threats. A client page (`TrustMapPage`) loads data via existing API endpoints, then composes `KanbanColumn` + `NodeCard` (DOM grid) with `FlowOverlay` (absolute SVG) and `BoundaryAnalysisPanel` (right sidebar). No new backend endpoints.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v3, lucide-react. No test runner exists in the frontend app — verification is `npx tsc --noEmit` + `npm run build` + manual smoke. Aggregation kept pure so it is straightforward to unit-test later if a runner is added.

**Spec:** `docs/superpowers/specs/2026-05-20-trust-map-kanban-design.md`

**Working dir for every task:** `apps/frontend`

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `apps/frontend/lib/trustMap.ts` | new | Types + pure `buildTrustMapView(layers, threats)` aggregator |
| `apps/frontend/app/projects/[projectId]/trust-map/page.tsx` | new | Next.js server route → renders client `TrustMapPage` |
| `apps/frontend/components/TrustMapPage.tsx` | new | Client root: top bar, data load, layout shell |
| `apps/frontend/components/trust-map/KanbanColumn.tsx` | new | One column per trust boundary |
| `apps/frontend/components/trust-map/NodeCard.tsx` | new | One card per contained node |
| `apps/frontend/components/trust-map/FlowOverlay.tsx` | new | Absolute SVG layer with cross-boundary arrows |
| `apps/frontend/components/trust-map/BoundaryAnalysisPanel.tsx` | new | Right sidebar with STRIDE threats by boundary pair |
| `apps/frontend/components/trust-map/trustMapColors.ts` | new | Shared palette by trust level (extracted from `TrustBoundaryNode`) |
| `apps/frontend/components/DiagramPage.tsx` | modify | Read `selectNode` query param on load and select that node |
| `apps/frontend/components/MenuBar.tsx` | modify | Add "Trust Map" entry under View menu |

---

## Task 1: Aggregation lib + types (`lib/trustMap.ts`)

**Files:**
- Create: `apps/frontend/lib/trustMap.ts`

- [ ] **Step 1: Create the file with all types and the pure aggregator**

```ts
// apps/frontend/lib/trustMap.ts
import type { Node, Edge } from 'reactflow';
import type { LayerMap } from './layerStore';
import type { NodeData } from './types';
import type { ProjectThreat, ThreatSeverity } from './api';

export type TrustLevel = 'internet' | 'external' | 'dmz' | 'internal' | 'custom';

export interface TrustMapCard {
  /** Globally unique card key: `${layerId}:${nodeId}` */
  key: string;
  nodeId: string;
  layerId: string;
  layerName: string;
  label: string;
  nodeType: string;
  subtitle?: string;
  containedBy: 'parent' | 'geometric';
}

export interface TrustMapColumn {
  boundaryId: string;
  boundaryKey: string; // `${layerId}:${boundaryId}`
  layerId: string;
  layerName: string;
  label: string;
  trustLevel: TrustLevel;
  cards: TrustMapCard[];
}

export interface TrustMapFlow {
  edgeId: string;
  layerId: string;
  sourceCardKey: string;
  targetCardKey: string;
  sourceBoundaryKey: string;
  targetBoundaryKey: string;
  threats: ProjectThreat[];
  highestSeverity: ThreatSeverity | null;
}

export interface TrustMapView {
  columns: TrustMapColumn[];
  flows: TrustMapFlow[];
  unboundedCards: TrustMapCard[]; // shown as trailing "Unassigned" column when non-empty
  /** Total card count across all columns + unbounded */
  cardCount: number;
}

const TRUST_LEVEL_RANK: Record<TrustLevel, number> = {
  internet: 0,
  external: 1,
  dmz: 2,
  internal: 3,
  custom: 4,
};

const SEVERITY_RANK: Record<ThreatSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INFO: 0,
};

function normalizeTrustLevel(data: NodeData | undefined): TrustLevel {
  const raw = (data?.trustLevel ?? 'internal').toLowerCase();
  return raw === 'internet' || raw === 'external' || raw === 'dmz' || raw === 'internal' || raw === 'custom'
    ? raw
    : 'custom';
}

function nodeArea(n: Node): number {
  const w = typeof n.width === 'number' ? n.width : 0;
  const h = typeof n.height === 'number' ? n.height : 0;
  return w * h;
}

function rectContains(boundary: Node, child: Node): boolean {
  const bw = typeof boundary.width === 'number' ? boundary.width : 0;
  const bh = typeof boundary.height === 'number' ? boundary.height : 0;
  const cw = typeof child.width === 'number' ? child.width : 0;
  const ch = typeof child.height === 'number' ? child.height : 0;
  if (bw === 0 || bh === 0) return false;
  const bx1 = boundary.position.x;
  const by1 = boundary.position.y;
  const bx2 = bx1 + bw;
  const by2 = by1 + bh;
  const cx1 = child.position.x;
  const cy1 = child.position.y;
  const cx2 = cx1 + cw;
  const cy2 = cy1 + ch;
  // child fully inside boundary
  return cx1 >= bx1 && cy1 >= by1 && cx2 <= bx2 && cy2 <= by2;
}

function makeCardKey(layerId: string, nodeId: string): string {
  return `${layerId}:${nodeId}`;
}

function deriveSubtitle(data: NodeData | undefined, nodeType: string): string | undefined {
  if (!data) return nodeType;
  if (data.technology) return data.technology;
  if (data.description && data.description.length <= 60) return data.description;
  return nodeType;
}

function buildCard(
  node: Node,
  layerId: string,
  layerName: string,
  containedBy: 'parent' | 'geometric',
): TrustMapCard {
  const data = node.data as NodeData | undefined;
  return {
    key: makeCardKey(layerId, node.id),
    nodeId: node.id,
    layerId,
    layerName,
    label: data?.label ?? node.id,
    nodeType: node.type ?? 'unknown',
    subtitle: deriveSubtitle(data, node.type ?? 'unknown'),
    containedBy,
  };
}

export function buildTrustMapView(layers: LayerMap, threats: ProjectThreat[]): TrustMapView {
  // 1. Collect every TrustBoundary across all layers.
  const boundaries: { node: Node; layerId: string; layerName: string }[] = [];
  for (const layer of Object.values(layers)) {
    for (const n of layer.nodes) {
      if (n.type === 'trustboundary') {
        boundaries.push({ node: n, layerId: layer.id, layerName: layer.name });
      }
    }
  }

  // 2. For each non-boundary node, decide which boundary owns it.
  //    Parent rule wins; otherwise smallest-area geometric containment.
  const cardByKey = new Map<string, TrustMapCard>();
  const boundaryKeyByCard = new Map<string, string>();
  const columns: TrustMapColumn[] = boundaries.map(({ node, layerId, layerName }) => ({
    boundaryId: node.id,
    boundaryKey: makeCardKey(layerId, node.id),
    layerId,
    layerName,
    label: (node.data as NodeData | undefined)?.label ?? 'Trust Boundary',
    trustLevel: normalizeTrustLevel(node.data as NodeData | undefined),
    cards: [],
  }));

  const columnByBoundaryKey = new Map<string, TrustMapColumn>();
  for (const col of columns) columnByBoundaryKey.set(col.boundaryKey, col);

  const unbounded: TrustMapCard[] = [];

  for (const layer of Object.values(layers)) {
    const layerBoundaries = boundaries.filter((b) => b.layerId === layer.id);

    for (const n of layer.nodes) {
      if (n.type === 'trustboundary') continue;
      const cardKey = makeCardKey(layer.id, n.id);
      if (cardByKey.has(cardKey)) continue;

      // Parent rule
      if (n.parentNode) {
        const parentMatch = layerBoundaries.find((b) => b.node.id === n.parentNode);
        if (parentMatch) {
          const card = buildCard(n, layer.id, layer.name, 'parent');
          cardByKey.set(card.key, card);
          const bk = makeCardKey(parentMatch.layerId, parentMatch.node.id);
          boundaryKeyByCard.set(card.key, bk);
          columnByBoundaryKey.get(bk)!.cards.push(card);
          continue;
        }
      }

      // Geometric rule: smallest-area containing boundary wins
      const containing = layerBoundaries
        .filter((b) => rectContains(b.node, n))
        .sort((a, b) => nodeArea(a.node) - nodeArea(b.node));
      if (containing.length > 0) {
        const winner = containing[0];
        const card = buildCard(n, layer.id, layer.name, 'geometric');
        cardByKey.set(card.key, card);
        const bk = makeCardKey(winner.layerId, winner.node.id);
        boundaryKeyByCard.set(card.key, bk);
        columnByBoundaryKey.get(bk)!.cards.push(card);
        continue;
      }

      // Unassigned
      const orphan = buildCard(n, layer.id, layer.name, 'geometric');
      cardByKey.set(orphan.key, orphan);
      unbounded.push(orphan);
    }
  }

  // 3. Walk edges, emit flows for cross-boundary edges, attach threats.
  const threatsByTarget = new Map<string, ProjectThreat[]>();
  for (const t of threats) {
    const list = threatsByTarget.get(t.targetId) ?? [];
    list.push(t);
    threatsByTarget.set(t.targetId, list);
  }

  const flows: TrustMapFlow[] = [];
  for (const layer of Object.values(layers)) {
    for (const edge of layer.edges as Edge[]) {
      const srcKey = makeCardKey(layer.id, edge.source);
      const tgtKey = makeCardKey(layer.id, edge.target);
      const srcBoundary = boundaryKeyByCard.get(srcKey);
      const tgtBoundary = boundaryKeyByCard.get(tgtKey);
      if (!srcBoundary || !tgtBoundary || srcBoundary === tgtBoundary) continue;

      const edgeThreats = threatsByTarget.get(edge.id) ?? [];
      let highest: ThreatSeverity | null = null;
      for (const t of edgeThreats) {
        if (!highest || SEVERITY_RANK[t.severity] > SEVERITY_RANK[highest]) highest = t.severity;
      }

      flows.push({
        edgeId: edge.id,
        layerId: layer.id,
        sourceCardKey: srcKey,
        targetCardKey: tgtKey,
        sourceBoundaryKey: srcBoundary,
        targetBoundaryKey: tgtBoundary,
        threats: edgeThreats,
        highestSeverity: highest,
      });
    }
  }

  // 4. Sort columns by trust-level rank, then by label.
  columns.sort((a, b) => {
    const r = TRUST_LEVEL_RANK[a.trustLevel] - TRUST_LEVEL_RANK[b.trustLevel];
    return r !== 0 ? r : a.label.localeCompare(b.label);
  });

  return {
    columns,
    flows,
    unboundedCards: unbounded,
    cardCount: cardByKey.size,
  };
}
```

- [ ] **Step 2: Type-check**

Run from repo root:
```bash
cd apps/frontend && npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/lib/trustMap.ts
git commit -m "feat(frontend): add trust-map aggregation lib"
```

---

## Task 2: Shared color palette (`trustMapColors.ts`)

**Files:**
- Create: `apps/frontend/components/trust-map/trustMapColors.ts`

- [ ] **Step 1: Create the palette module**

```ts
// apps/frontend/components/trust-map/trustMapColors.ts
import type { TrustLevel } from '@/lib/trustMap';
import type { ThreatSeverity } from '@/lib/api';

export interface TrustLevelStyle {
  border: string;
  fill: string;
  badge: string;   // tailwind classes for the small badge chip
  label: string;
}

export const TRUST_LEVEL_STYLES: Record<TrustLevel, TrustLevelStyle> = {
  internet: {
    border: '#b91c1c',
    fill: 'rgba(185, 28, 28, 0.06)',
    badge: 'bg-red-200 text-red-800 border-red-400',
    label: 'INTERNET',
  },
  external: {
    border: '#ef4444',
    fill: 'rgba(239, 68, 68, 0.06)',
    badge: 'bg-red-100 text-red-700 border-red-300',
    label: 'EXTERNAL',
  },
  dmz: {
    border: '#f59e0b',
    fill: 'rgba(245, 158, 11, 0.06)',
    badge: 'bg-amber-100 text-amber-700 border-amber-300',
    label: 'DMZ',
  },
  internal: {
    border: '#22c55e',
    fill: 'rgba(34, 197, 94, 0.06)',
    badge: 'bg-green-100 text-green-700 border-green-300',
    label: 'INTERNAL',
  },
  custom: {
    border: '#64748b',
    fill: 'rgba(100, 116, 139, 0.06)',
    badge: 'bg-slate-100 text-slate-600 border-slate-300',
    label: 'CUSTOM',
  },
};

/** Stroke color for a flow path based on highest threat severity */
export function severityStroke(s: ThreatSeverity | null): string {
  switch (s) {
    case 'CRITICAL': return '#dc2626';
    case 'HIGH':     return '#ea580c';
    case 'MEDIUM':   return '#f59e0b';
    case 'LOW':      return '#0891b2';
    case 'INFO':     return '#64748b';
    default:         return '#94a3b8';
  }
}

/** Tailwind classes for severity badge chips */
export function severityBadge(s: ThreatSeverity): string {
  switch (s) {
    case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-200';
    case 'HIGH':     return 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-200';
    case 'MEDIUM':   return 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200';
    case 'LOW':      return 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900/40 dark:text-cyan-200';
    case 'INFO':     return 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300';
  }
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/frontend && npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/components/trust-map/trustMapColors.ts
git commit -m "feat(frontend): add trust-map color palette module"
```

---

## Task 3: Route stub + page placeholder

**Files:**
- Create: `apps/frontend/app/projects/[projectId]/trust-map/page.tsx`
- Create: `apps/frontend/components/TrustMapPage.tsx` (placeholder)

- [ ] **Step 1: Create the server route**

```tsx
// apps/frontend/app/projects/[projectId]/trust-map/page.tsx
import TrustMapPage from '@/components/TrustMapPage';

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <TrustMapPage projectId={projectId} />;
}
```

> Note: Next.js 16 App Router uses async `params` (Promise). Confirm against an existing route like `app/projects/[projectId]/threats/page.tsx` if signature differs and follow that pattern.

- [ ] **Step 2: Create the client component placeholder**

```tsx
// apps/frontend/components/TrustMapPage.tsx
'use client';

interface Props {
  projectId: string;
}

export default function TrustMapPage({ projectId }: Props) {
  return (
    <div className="flex h-screen items-center justify-center bg-white text-slate-600 dark:bg-gray-950 dark:text-slate-300">
      Trust Map for project {projectId} — coming soon
    </div>
  );
}
```

- [ ] **Step 3: Build + smoke test**

```bash
cd apps/frontend && npx tsc --noEmit
```
Expected: 0 errors.

Run dev and visit `/projects/<some-id>/trust-map` — confirm placeholder renders.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/app/projects/[projectId]/trust-map/page.tsx apps/frontend/components/TrustMapPage.tsx
git commit -m "feat(frontend): scaffold trust-map route + page placeholder"
```

---

## Task 4: Top bar + data load

**Files:**
- Modify: `apps/frontend/components/TrustMapPage.tsx`

- [ ] **Step 1: Replace placeholder with top bar + data load + skeleton layout**

Open `apps/frontend/components/ThreatsDashboardPage.tsx` and copy the exact header markup as a reference (logo, back btn, separator, page context, right-side controls). Keep classnames identical so styling stays consistent across secondary pages.

```tsx
// apps/frontend/components/TrustMapPage.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, ArrowLeft, Loader2, AlertCircle,
  Sun, Moon, Monitor, LogOut,
} from 'lucide-react';
import LayersLogo from '@/components/LayersLogo';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import {
  apiGetProject, apiGetProjectDraft, apiListProjectThreats,
  type ProjectThreat,
} from '@/lib/api';
import { getStoredUser, signOut } from '@/lib/authStore';
import { useTheme } from '@/lib/themeContext';
import type { LayerMap, ProjectFile } from '@/lib/layerStore';
import { buildTrustMapView, type TrustMapView } from '@/lib/trustMap';

interface Props {
  projectId: string;
}

export default function TrustMapPage({ projectId }: Props) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const storedUser = getStoredUser();

  const [projectName, setProjectName] = useState<string | null>(null);
  const [view, setView] = useState<TrustMapView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cycleTheme = () => {
    const cycle = ['light', 'dark', 'system'] as const;
    setTheme(cycle[(cycle.indexOf(theme as 'light' | 'dark' | 'system') + 1) % cycle.length]);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [project, draft, threatsResult] = await Promise.all([
          apiGetProject(projectId),
          apiGetProjectDraft(projectId),
          apiListProjectThreats(projectId, { limit: 500 }),
        ]);
        if (cancelled) return;

        setProjectName(project.name);

        const layers: LayerMap =
          draft && (draft.canvasData as ProjectFile | undefined)?.layers
            ? (draft.canvasData as ProjectFile).layers
            : {};

        const threats: ProjectThreat[] = threatsResult.data ?? [];
        setView(buildTrustMapView(layers, threats));
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Failed to load trust map');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const flowCount = view?.flows.length ?? 0;
  const cardCount = view?.cardCount ?? 0;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-gray-950">
      {/* Top bar — h-9 secondary page pattern */}
      <header className="flex h-9 flex-shrink-0 items-center border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="mr-4 flex items-center gap-1.5 pl-1">
          <LayersLogo size={14} />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Layers</span>
        </div>
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="flex items-center gap-1.5 rounded px-3 py-1 text-sm text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ArrowLeft size={13} /> Back to diagram
        </button>
        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-accent-500" />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {projectName ?? '...'} — Trust Map
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={cycleTheme}
            className="rounded p-1 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
            title={`Theme: ${theme}`}
          >
            {theme === 'light' ? <Sun size={13} /> : theme === 'dark' ? <Moon size={13} /> : <Monitor size={13} />}
          </button>
          <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
          {storedUser && <span className="px-1.5 text-xs text-slate-500 dark:text-slate-400">{storedUser.email}</span>}
          <button
            onClick={() => { signOut(); router.push('/login'); }}
            className="rounded p-1 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">
            <Loader2 size={20} className="mr-2 animate-spin" /> Loading trust map…
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={AlertCircle}
              title="Couldn't load trust map"
              description={error}
            />
          </div>
        ) : !view || (view.columns.length === 0 && view.unboundedCards.length === 0) ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={ShieldCheck}
              title="No trust boundaries yet"
              description="Add a Trust Boundary node in your diagram to populate the trust map."
              action={
                <Button onClick={() => router.push(`/projects/${projectId}`)}>
                  Open diagram
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid h-full grid-cols-[1fr_340px]">
            {/* Kanban region (filled in Task 5) */}
            <div className="relative flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {projectName ?? 'project'} — trust map
                </span>
                <span className="text-slate-400">·</span>
                <span>{cardCount} nodes</span>
                <span className="text-slate-400">·</span>
                <span>{flowCount} flows</span>
              </div>
              {/* Columns + overlay go here (Task 5/7) */}
              <div className="flex-1 overflow-auto p-4 text-sm text-slate-400">columns placeholder</div>
            </div>
            {/* Right panel (filled in Task 8) */}
            <aside className="border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-gray-950">
              <div className="p-4 text-sm text-slate-400">analysis placeholder</div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
```

> If `LayersLogo` is not exported as default from `@/components/LayersLogo`, copy the import style used by `ThreatsDashboardPage.tsx` exactly.

- [ ] **Step 2: Verify**

```bash
cd apps/frontend && npx tsc --noEmit
```
Expected: 0 errors.

Run dev, visit `/projects/<id>/trust-map`. Expect: top bar with project name, "Loading…" then either the empty state ("No trust boundaries yet") or a grid with placeholder text.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/components/TrustMapPage.tsx
git commit -m "feat(frontend): trust-map page top bar + data load shell"
```

---

## Task 5: KanbanColumn + NodeCard

**Files:**
- Create: `apps/frontend/components/trust-map/KanbanColumn.tsx`
- Create: `apps/frontend/components/trust-map/NodeCard.tsx`
- Modify: `apps/frontend/components/TrustMapPage.tsx` (render columns + handle card click)

- [ ] **Step 1: Create `NodeCard.tsx`**

```tsx
// apps/frontend/components/trust-map/NodeCard.tsx
'use client';

import { Box } from 'lucide-react';
import type { TrustMapCard } from '@/lib/trustMap';

interface Props {
  card: TrustMapCard;
  highlighted?: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  /** Forwarded so FlowOverlay can measure DOM rects */
  cardRef?: (el: HTMLDivElement | null) => void;
}

export default function NodeCard({
  card,
  highlighted,
  onClick,
  onMouseEnter,
  onMouseLeave,
  cardRef,
}: Props) {
  return (
    <div
      ref={cardRef}
      data-card-key={card.key}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`group cursor-pointer rounded-md border bg-white px-2.5 py-2 shadow-sm transition dark:bg-slate-800
        ${highlighted
          ? 'border-blue-400 ring-2 ring-blue-300 dark:border-blue-500 dark:ring-blue-700'
          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'}
      `}
    >
      <div className="flex items-center gap-1.5">
        <Box size={11} className="text-slate-400" />
        <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
          {card.label}
        </span>
      </div>
      {card.subtitle && (
        <div className="mt-0.5 truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">
          {card.subtitle}
        </div>
      )}
      <div className="mt-1 flex items-center gap-1">
        <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300">
          {card.layerName}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `KanbanColumn.tsx`**

```tsx
// apps/frontend/components/trust-map/KanbanColumn.tsx
'use client';

import type { TrustMapColumn } from '@/lib/trustMap';
import { TRUST_LEVEL_STYLES } from './trustMapColors';
import NodeCard from './NodeCard';

interface Props {
  column: TrustMapColumn;
  /** Set of card keys currently highlighted (e.g. due to a hovered flow) */
  highlightedCardKeys: Set<string>;
  onCardClick: (card: TrustMapColumn['cards'][number]) => void;
  onCardHover: (cardKey: string | null) => void;
  /** Called per card with the DOM node so FlowOverlay can measure rects */
  registerCardRef: (cardKey: string, el: HTMLDivElement | null) => void;
}

export default function KanbanColumn({
  column,
  highlightedCardKeys,
  onCardClick,
  onCardHover,
  registerCardRef,
}: Props) {
  const style = TRUST_LEVEL_STYLES[column.trustLevel];
  return (
    <div
      className="flex w-60 flex-shrink-0 flex-col rounded-md border bg-white/40 dark:bg-slate-900/40"
      style={{ borderColor: style.border, backgroundColor: style.fill }}
    >
      <div className="flex items-center justify-between gap-2 border-b px-2.5 py-1.5" style={{ borderColor: style.border }}>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-100">
            {column.label}
          </span>
          <span className={`rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider ${style.badge}`}>
            {style.label}
          </span>
        </div>
        <span className="text-[10px] text-slate-500 dark:text-slate-400">{column.cards.length}</span>
      </div>
      <div className="flex flex-col gap-1.5 overflow-y-auto p-2">
        {column.cards.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 px-2 py-3 text-center text-[10px] text-slate-400 dark:border-slate-700">
            no nodes in this boundary
          </div>
        ) : (
          column.cards.map((card) => (
            <NodeCard
              key={card.key}
              card={card}
              highlighted={highlightedCardKeys.has(card.key)}
              onClick={() => onCardClick(card)}
              onMouseEnter={() => onCardHover(card.key)}
              onMouseLeave={() => onCardHover(null)}
              cardRef={(el) => registerCardRef(card.key, el)}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire columns into `TrustMapPage.tsx`**

Replace the `columns placeholder` div from Task 4 with this block. Add the imports + state at the top of `TrustMapPage`:

```tsx
// Add to TrustMapPage.tsx imports
import { useRef, useCallback } from 'react';
import KanbanColumn from './trust-map/KanbanColumn';
import type { TrustMapCard } from '@/lib/trustMap';

// Add inside TrustMapPage(), above the return:
const [hoveredCardKey, setHoveredCardKey] = useState<string | null>(null);
const cardRefsRef = useRef<Map<string, HTMLDivElement>>(new Map());

const registerCardRef = useCallback((cardKey: string, el: HTMLDivElement | null) => {
  const map = cardRefsRef.current;
  if (el) map.set(cardKey, el);
  else map.delete(cardKey);
}, []);

const handleCardClick = useCallback((card: TrustMapCard) => {
  router.push(`/projects/${projectId}?currLayer=${card.layerId}&selectNode=${card.nodeId}`);
}, [router, projectId]);

// highlightedCardKeys derived in Task 7; for now use an empty set
const highlightedCardKeys = new Set<string>();
```

Replace the kanban placeholder block:

```tsx
<div className="relative flex-1 overflow-x-auto overflow-y-hidden">
  <div className="flex h-full min-w-max gap-3 p-4">
    {view!.columns.map((col) => (
      <KanbanColumn
        key={col.boundaryKey}
        column={col}
        highlightedCardKeys={highlightedCardKeys}
        onCardClick={handleCardClick}
        onCardHover={setHoveredCardKey}
        registerCardRef={registerCardRef}
      />
    ))}
    {view!.unboundedCards.length > 0 && (
      <KanbanColumn
        column={{
          boundaryId: '__unassigned__',
          boundaryKey: '__unassigned__',
          layerId: '',
          layerName: '',
          label: 'Unassigned',
          trustLevel: 'custom',
          cards: view!.unboundedCards,
        }}
        highlightedCardKeys={highlightedCardKeys}
        onCardClick={handleCardClick}
        onCardHover={setHoveredCardKey}
        registerCardRef={registerCardRef}
      />
    )}
  </div>
</div>
```

Suppress the unused-`hoveredCardKey` warning for now — it gets read in Task 7.

- [ ] **Step 4: Verify**

```bash
cd apps/frontend && npx tsc --noEmit
```
Expected: 0 errors.

Visit a project's `/trust-map` URL. Expect: columns rendered horizontally, cards inside, hover highlights card border, click navigates back to canvas with `?currLayer=...&selectNode=...` in URL (no-op until Task 9).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/components/trust-map/KanbanColumn.tsx apps/frontend/components/trust-map/NodeCard.tsx apps/frontend/components/TrustMapPage.tsx
git commit -m "feat(frontend): trust-map columns and node cards"
```

---

## Task 6: FlowOverlay (SVG arrows)

**Files:**
- Create: `apps/frontend/components/trust-map/FlowOverlay.tsx`
- Modify: `apps/frontend/components/TrustMapPage.tsx` (render overlay over columns)

- [ ] **Step 1: Create `FlowOverlay.tsx`**

```tsx
// apps/frontend/components/trust-map/FlowOverlay.tsx
'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TrustMapFlow } from '@/lib/trustMap';
import { severityStroke } from './trustMapColors';

interface Props {
  flows: TrustMapFlow[];
  /** Container the overlay is absolute-positioned within (scrolling kanban region) */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Map of cardKey → DOM element */
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  hoveredFlowEdgeId: string | null;
  hoveredCardKey: string | null;
  onFlowHover: (edgeId: string | null) => void;
  onFlowClick: (flow: TrustMapFlow) => void;
}

interface FlowPath {
  flow: TrustMapFlow;
  d: string;
}

export default function FlowOverlay({
  flows,
  containerRef,
  cardRefs,
  hoveredFlowEdgeId,
  hoveredCardKey,
  onFlowHover,
  onFlowClick,
}: Props) {
  const [paths, setPaths] = useState<FlowPath[]>([]);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const rafRef = useRef<number | null>(null);

  const compute = () => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;
    setSize({ w: container.scrollWidth, h: container.scrollHeight });

    const next: FlowPath[] = [];
    for (const flow of flows) {
      const srcEl = cardRefs.current.get(flow.sourceCardKey);
      const tgtEl = cardRefs.current.get(flow.targetCardKey);
      if (!srcEl || !tgtEl) continue;
      const s = srcEl.getBoundingClientRect();
      const t = tgtEl.getBoundingClientRect();

      const sx = s.right - containerRect.left + scrollLeft;
      const sy = s.top + s.height / 2 - containerRect.top + scrollTop;
      const tx = t.left - containerRect.left + scrollLeft;
      const ty = t.top + t.height / 2 - containerRect.top + scrollTop;

      const dx = Math.max(40, Math.abs(tx - sx) / 2);
      const d = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
      next.push({ flow, d });
    }
    setPaths(next);
  };

  const schedule = () => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      compute();
    });
  };

  useLayoutEffect(() => {
    compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flows]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(schedule);
    ro.observe(container);
    const onScroll = () => schedule();
    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      ro.disconnect();
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', schedule);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={size.w}
      height={size.h}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <marker id="trustmap-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>
      {paths.map(({ flow, d }) => {
        const isHoveredFlow = hoveredFlowEdgeId === flow.edgeId;
        const isHoveredByCard =
          hoveredCardKey != null &&
          (hoveredCardKey === flow.sourceCardKey || hoveredCardKey === flow.targetCardKey);
        const active = isHoveredFlow || isHoveredByCard;
        const stroke = severityStroke(flow.highestSeverity);
        return (
          <path
            key={flow.edgeId}
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={active ? 2.5 : 1.5}
            strokeDasharray={flow.highestSeverity ? undefined : '4 3'}
            opacity={hoveredFlowEdgeId == null && hoveredCardKey == null ? 0.7 : active ? 1 : 0.2}
            color={stroke}
            markerEnd="url(#trustmap-arrow)"
            className="pointer-events-auto cursor-pointer transition"
            onMouseEnter={() => onFlowHover(flow.edgeId)}
            onMouseLeave={() => onFlowHover(null)}
            onClick={() => onFlowClick(flow)}
          />
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Wire overlay into `TrustMapPage.tsx`**

Add to imports:

```tsx
import FlowOverlay from './trust-map/FlowOverlay';
```

Add state above the return:

```tsx
const [hoveredFlowEdgeId, setHoveredFlowEdgeId] = useState<string | null>(null);
const kanbanScrollRef = useRef<HTMLDivElement | null>(null);

const handleFlowClick = useCallback((flow: import('@/lib/trustMap').TrustMapFlow) => {
  // Right-panel scroll-to-threat handled in Task 8 via a state setter.
  setHoveredFlowEdgeId(flow.edgeId);
}, []);
```

Replace the kanban-region outer div from Task 5 — give the *scrollable container* a ref and mount `FlowOverlay` inside it just before the inner column flex row:

```tsx
<div ref={kanbanScrollRef} className="relative flex-1 overflow-x-auto overflow-y-hidden">
  <FlowOverlay
    flows={view!.flows}
    containerRef={kanbanScrollRef}
    cardRefs={cardRefsRef}
    hoveredFlowEdgeId={hoveredFlowEdgeId}
    hoveredCardKey={hoveredCardKey}
    onFlowHover={setHoveredFlowEdgeId}
    onFlowClick={handleFlowClick}
  />
  <div className="flex h-full min-w-max gap-3 p-4">
    {/* columns from Task 5 unchanged */}
  </div>
</div>
```

- [ ] **Step 3: Verify**

```bash
cd apps/frontend && npx tsc --noEmit
```
Expected: 0 errors.

Smoke: open a project with cross-boundary edges. Expect SVG arrows between cards in different columns, colored by severity, dimming non-hovered arrows when one card or arrow is hovered.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/components/trust-map/FlowOverlay.tsx apps/frontend/components/TrustMapPage.tsx
git commit -m "feat(frontend): trust-map SVG flow overlay"
```

---

## Task 7: Hover highlighting (cards ↔ flows)

**Files:**
- Modify: `apps/frontend/components/TrustMapPage.tsx`

- [ ] **Step 1: Compute `highlightedCardKeys` from hovered flow**

Replace the empty `highlightedCardKeys` line from Task 5 with derived logic that responds to the hovered flow:

```tsx
const highlightedCardKeys = (() => {
  const set = new Set<string>();
  if (hoveredFlowEdgeId) {
    const f = view?.flows.find((x) => x.edgeId === hoveredFlowEdgeId);
    if (f) {
      set.add(f.sourceCardKey);
      set.add(f.targetCardKey);
    }
  }
  return set;
})();
```

- [ ] **Step 2: Verify**

```bash
cd apps/frontend && npx tsc --noEmit
```
Expected: 0 errors.

Smoke: hover a flow path → both connected cards get a blue ring; hover a card → matching flow path becomes opaque while others dim.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/components/TrustMapPage.tsx
git commit -m "feat(frontend): bidirectional hover highlight in trust map"
```

---

## Task 8: BoundaryAnalysisPanel (right sidebar)

**Files:**
- Create: `apps/frontend/components/trust-map/BoundaryAnalysisPanel.tsx`
- Modify: `apps/frontend/components/TrustMapPage.tsx`

- [ ] **Step 1: Create `BoundaryAnalysisPanel.tsx`**

```tsx
// apps/frontend/components/trust-map/BoundaryAnalysisPanel.tsx
'use client';

import { useMemo, useEffect, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import type { TrustMapFlow, TrustMapView } from '@/lib/trustMap';
import type { ProjectThreat, ThreatSeverity } from '@/lib/api';
import { severityBadge } from './trustMapColors';

interface Props {
  view: TrustMapView;
  projectId: string;
  hoveredFlowEdgeId: string | null;
  onThreatClick: (flow: TrustMapFlow, threat: ProjectThreat) => void;
}

interface PairGroup {
  key: string;
  sourceLabel: string;
  targetLabel: string;
  flows: TrustMapFlow[];
  threats: { flow: TrustMapFlow; threat: ProjectThreat }[];
}

const SEVERITY_RANK: Record<ThreatSeverity, number> = {
  CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0,
};

export default function BoundaryAnalysisPanel({
  view, projectId, hoveredFlowEdgeId, onThreatClick,
}: Props) {
  // Group flows by source→target boundary pair
  const groups: PairGroup[] = useMemo(() => {
    const byKey = new Map<string, PairGroup>();
    const colByKey = new Map(view.columns.map((c) => [c.boundaryKey, c]));
    for (const flow of view.flows) {
      const pairKey = `${flow.sourceBoundaryKey} → ${flow.targetBoundaryKey}`;
      let g = byKey.get(pairKey);
      if (!g) {
        const src = colByKey.get(flow.sourceBoundaryKey);
        const tgt = colByKey.get(flow.targetBoundaryKey);
        g = {
          key: pairKey,
          sourceLabel: src?.label ?? '?',
          targetLabel: tgt?.label ?? '?',
          flows: [],
          threats: [],
        };
        byKey.set(pairKey, g);
      }
      g.flows.push(flow);
      for (const t of flow.threats) g.threats.push({ flow, threat: t });
    }
    // sort groups by max-severity desc
    return Array.from(byKey.values()).sort((a, b) => {
      const ma = Math.max(0, ...a.threats.map((x) => SEVERITY_RANK[x.threat.severity] ?? 0));
      const mb = Math.max(0, ...b.threats.map((x) => SEVERITY_RANK[x.threat.severity] ?? 0));
      return mb - ma;
    });
  }, [view]);

  const totals = useMemo(() => {
    const t = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 } as Record<ThreatSeverity, number>;
    for (const f of view.flows) for (const th of f.threats) t[th.severity]++;
    return t;
  }, [view.flows]);

  // Scroll to the hovered flow's first threat row when hover changes
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hoveredFlowEdgeId || !containerRef.current) return;
    const el = containerRef.current.querySelector<HTMLElement>(`[data-flow-id="${hoveredFlowEdgeId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [hoveredFlowEdgeId]);

  return (
    <aside className="flex h-full flex-col border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-gray-950">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Boundary analysis
        </div>
        <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          STRIDE · {view.flows.length} flows · {view.cardCount} nodes
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as ThreatSeverity[]).map((s) => (
            totals[s] > 0 ? (
              <span key={s} className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${severityBadge(s)}`}>
                {s.slice(0, 4)} {totals[s]}
              </span>
            ) : null
          ))}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {groups.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No cross-boundary flows detected.
          </div>
        ) : groups.map((g) => (
          <div key={g.key} className="rounded border border-slate-200 dark:border-slate-700">
            <div className="border-b border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {g.sourceLabel} → {g.targetLabel}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {g.threats.length === 0 ? (
                <div className="px-2.5 py-2 text-[11px] text-slate-500 dark:text-slate-400">
                  No threats on these flows.
                </div>
              ) : g.threats.map(({ flow, threat }) => (
                <button
                  key={`${flow.edgeId}-${threat.id}`}
                  data-flow-id={flow.edgeId}
                  onClick={() => onThreatClick(flow, threat)}
                  className={`flex w-full flex-col gap-1 px-2.5 py-2 text-left text-[11px] transition hover:bg-slate-50 dark:hover:bg-slate-800
                    ${hoveredFlowEdgeId === flow.edgeId ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    <span className={`rounded border px-1 py-0.5 font-mono text-[9px] font-bold ${severityBadge(threat.severity)}`}>
                      {threat.severity.slice(0, 4)}
                    </span>
                    <span className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[9px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {threat.strideCategory.slice(0, 1)}
                    </span>
                    <span className="truncate font-semibold text-slate-700 dark:text-slate-200">
                      {threat.title}
                    </span>
                  </div>
                  <div className="line-clamp-2 text-slate-500 dark:text-slate-400">
                    {threat.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 px-3 py-2 text-[11px] dark:border-slate-700">
        <a
          href={`/projects/${projectId}/threats`}
          className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
        >
          View all threats <ExternalLink size={10} />
        </a>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Wire panel into `TrustMapPage.tsx`**

Add import:

```tsx
import BoundaryAnalysisPanel from './trust-map/BoundaryAnalysisPanel';
```

Replace the right-side `<aside>` placeholder from Task 4 with:

```tsx
<BoundaryAnalysisPanel
  view={view!}
  projectId={projectId}
  hoveredFlowEdgeId={hoveredFlowEdgeId}
  onThreatClick={(flow) => setHoveredFlowEdgeId(flow.edgeId)}
/>
```

- [ ] **Step 3: Verify**

```bash
cd apps/frontend && npx tsc --noEmit
```
Expected: 0 errors.

Smoke: panel shows per-pair sections, threats listed, hovering a flow auto-scrolls to that flow's threat row and highlights it (blue tint). Clicking a threat row highlights the matching flow in the overlay.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/components/trust-map/BoundaryAnalysisPanel.tsx apps/frontend/components/TrustMapPage.tsx
git commit -m "feat(frontend): trust-map boundary analysis right panel"
```

---

## Task 9: `selectNode` query param support in `DiagramPage`

**Files:**
- Modify: `apps/frontend/components/DiagramPage.tsx`

- [ ] **Step 1: Read the query param on diagram load**

Open `apps/frontend/components/DiagramPage.tsx`. Locate the `useSearchParams()` usage (it should already read `currLayer`). Add `selectNode`:

```tsx
const selectNodeParam = searchParams.get('selectNode');
```

- [ ] **Step 2: Apply the selection after the canvas loads**

Find the place where the layer is switched after URL load (look for `currLayer` handling and the call into the `ReactFlowInstance` / setter that sets node selection). In a new `useEffect` that fires when the current layer and its nodes are loaded, mark the requested node selected:

```tsx
useEffect(() => {
  if (!selectNodeParam) return;
  const rf = rfInstanceRef.current;
  if (!rf) return;
  rf.setNodes((ns) =>
    ns.map((n) => ({ ...n, selected: n.id === selectNodeParam }))
  );
  // Clear the param so a refresh doesn't keep forcing selection
  const next = new URLSearchParams(searchParams.toString());
  next.delete('selectNode');
  router.replace(`/projects/${projectId}?${next.toString()}`);
}, [selectNodeParam, currentLayerId]); // eslint-disable-line react-hooks/exhaustive-deps
```

> Match variable names to the file (`rfInstanceRef`, `currentLayerId`, `projectId`, `router`, `searchParams`). If `setNodes` is not exposed, use `rfInstanceRef.current.updateNodeData` only for selection — fall back to the existing selection API used by `DiagramCanvas` (search the file for `selected:` or `setNodes`).

- [ ] **Step 3: Verify**

```bash
cd apps/frontend && npx tsc --noEmit
```
Expected: 0 errors.

Smoke: from Trust Map, click any card. Browser navigates to `/projects/:id?currLayer=...&selectNode=...`, canvas opens on correct layer, target node renders with React Flow selection ring. URL `selectNode` cleared.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/components/DiagramPage.tsx
git commit -m "feat(frontend): support ?selectNode= query param in DiagramPage"
```

---

## Task 10: MenuBar entry

**Files:**
- Modify: `apps/frontend/components/MenuBar.tsx`

- [ ] **Step 1: Add View → Trust Map**

Open `apps/frontend/components/MenuBar.tsx`. Find the View dropdown and the existing "Threats Dashboard" item (search for `/threats`). Add a sibling item just before it:

```tsx
<DropdownMenuItem
  onSelect={() => router.push(`/projects/${projectId}/trust-map`)}
>
  Trust Map
</DropdownMenuItem>
```

> Match component naming exactly to what `MenuBar.tsx` already uses for other view items (`DropdownItem`, `MenuButton`, etc.). If the file already uses inline buttons rather than a dropdown library, copy the styling of the adjacent "Threats Dashboard" entry verbatim.

- [ ] **Step 2: Verify**

```bash
cd apps/frontend && npx tsc --noEmit
```
Expected: 0 errors.

Smoke: open MenuBar → View → click "Trust Map" → navigates to `/projects/<id>/trust-map`.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/components/MenuBar.tsx
git commit -m "feat(frontend): MenuBar entry for trust map"
```

---

## Task 11: Empty-state polish for no-threats case

**Files:**
- Modify: `apps/frontend/components/trust-map/BoundaryAnalysisPanel.tsx`

- [ ] **Step 1: Add CTA when there are flows but zero threats overall**

In `BoundaryAnalysisPanel.tsx`, before the `groups.length === 0` block, check whether `view.flows.length > 0` and every flow has zero threats. If so, render a CTA pointing users at the canvas (where `AIChatPanel` can run threat analysis):

```tsx
const allFlowsThreatFree =
  view.flows.length > 0 && view.flows.every((f) => f.threats.length === 0);

{allFlowsThreatFree && (
  <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-200">
    Cross-boundary flows detected but no threats saved yet.
    {' '}
    <a href={`/projects/${projectId}`} className="font-semibold underline">Open diagram</a> and run STRIDE analysis from the AI chat.
  </div>
)}
```

Place the snippet inside the scroll container, above the `groups.map(...)` loop.

- [ ] **Step 2: Verify**

```bash
cd apps/frontend && npx tsc --noEmit
```
Expected: 0 errors.

Smoke: load a project that has trust boundaries + cross-boundary edges but no saved threat models → expect the amber CTA at the top of the right panel.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/components/trust-map/BoundaryAnalysisPanel.tsx
git commit -m "feat(frontend): trust-map empty-state CTA when no threats saved"
```

---

## Task 12: Final verification

**Files:** none

- [ ] **Step 1: Type-check + build**

```bash
cd apps/frontend && npx tsc --noEmit && npm run build
```
Expected: tsc 0 errors; build completes.

- [ ] **Step 2: Manual smoke checklist**

Load a real project with ≥2 trust boundaries across multiple layers and at least one saved threat model. Verify each:

1. Top bar matches secondary-page pattern (h-9, logo, back btn, theme cycle, user email, LogOut).
2. Columns appear in trust-level order: INTERNET → EXTERNAL → DMZ → INTERNAL → CUSTOM.
3. Cards land in the right columns (test both parent-rule and geometric-rule containment).
4. Cards with no boundary appear in trailing "Unassigned" column.
5. Cross-boundary edges render as colored arrows; intra-boundary edges do not.
6. Hover a card → matching flows become opaque, others dim; both endpoints get blue ring.
7. Hover a flow → both connected cards get blue ring; right panel auto-scrolls to first matching threat and highlights it.
8. Click a threat row → matching flow becomes the hovered flow (visible highlight).
9. Click a card → navigates to `/projects/:id?currLayer=...&selectNode=...`, canvas opens on correct layer, target node is selected.
10. Dark mode and light mode both look right.
11. Empty cases:
    - Project with no trust boundaries → "No trust boundaries yet" empty state with "Open diagram" CTA.
    - Project with flows but no threats → amber CTA in right panel.
12. MenuBar → View → "Trust Map" navigates here from the canvas.

- [ ] **Step 3: Commit any final tidy-ups (if needed) and push**

```bash
git push -u origin feat/kanban-for-nodes
```
