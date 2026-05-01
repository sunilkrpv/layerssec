# Projects List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 967-line `ProjectsListPage` monolith with focused per-component files under `components/projects/`, drop the static `InfoPanel`, move project rename + description editing into the side-sheet, and URL-sync the search and status filter.

**Architecture:** Decompose the monolith into focused per-component files. The dashboard becomes a slim orchestrator that owns URL-synced filter state, list fetch, modal triggers, and the side-sheet selection. The side-sheet absorbs project name/description editing alongside its existing version-history flow. A thin `ProjectStatusPill` wrapper replaces the hand-rolled inline `StatusBadge`. Helpers (`projectColor`, `formatRelativeDate`) move into `lib/projectBadges.ts`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS v3 (`darkMode: 'class'`), `lucide-react`. Shared primitives: `Button`, `IconButton`, `Tooltip`, `EmptyState`, `DropdownMenu`. No backend changes — `apiUpdateProject(id, { name?, description? })` already exists; `Project.description: string | null` is on the model.

**Branch:** `feat/projects-list-redesign` (already created, holds the design spec at `45909b9`).

**Quality gates per task:**
- `npx tsc --noEmit` → 0 errors
- `npm run build` → "Compiled successfully"
- **Do NOT** run `npm run lint` — pre-existing broken in Next 16 at the repo level.
- Manual: every visible surface verified in both light and dark mode where applicable.

---

## Task 1: Extract `lib/projectBadges.ts`

**Files:**
- Create: `lib/projectBadges.ts`
- Modify: `components/ProjectsListPage.tsx` (delete the inline definitions, add import)

**Context:** The monolith carries `PROJECT_COLORS` (8-tuple palette), a `projectColor(id)` hash-to-palette helper, and a local `formatDate(iso)` function. The new per-component files need these. Centralize.

- [ ] **Step 1: Create `lib/projectBadges.ts`**

```ts
export const PROJECT_COLORS = [
  { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-blue-600 dark:text-blue-400' },
  { bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400' },
  { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400' },
  { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400' },
  { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-600 dark:text-rose-400' },
  { bg: 'bg-sky-50 dark:bg-sky-900/20', text: 'text-sky-600 dark:text-sky-400' },
  { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400' },
  { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-400' },
];

export function projectColor(id: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PROJECT_COLORS[hash % PROJECT_COLORS.length];
}

export function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
```

- [ ] **Step 2: Replace inline definitions in `components/ProjectsListPage.tsx`**

Delete the inline `PROJECT_COLORS` constant (lines ~23–32), `projectColor` function (lines ~34–38), and `formatDate` function (lines ~40–49). Add to the imports near the top:

```tsx
import { projectColor, formatRelativeDate } from '@/lib/projectBadges';
```

Rename all usages of `formatDate` → `formatRelativeDate` in this file. Existing `projectColor` calls compile unchanged.

- [ ] **Step 3: Verify type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: "Compiled successfully"

- [ ] **Step 5: Commit**

```bash
git add lib/projectBadges.ts components/ProjectsListPage.tsx
git commit -m "refactor(projects): extract projectColor + formatRelativeDate to lib/projectBadges"
```

---

## Task 2: Create `ProjectStatusPill`

**Files:**
- Create: `components/projects/ProjectStatusPill.tsx`

**Context:** The monolith has an inline `StatusBadge` component that renders three project-specific states. Spec §2 requires a thin local wrapper named `ProjectStatusPill` that uses the same colour tokens but project-appropriate copy. The hand-rolled inline `StatusBadge` will be deleted in Task 7 (when the table is extracted) and Task 8 (orchestrator rebuild) — this task only adds the new component.

- [ ] **Step 1: Create `components/projects/ProjectStatusPill.tsx`**

```tsx
import { FileEdit, Lock } from 'lucide-react';

export interface ProjectStatusPillProps {
  hasDraft: boolean;
  publishedCount: number;
}

export function ProjectStatusPill({ hasDraft, publishedCount }: ProjectStatusPillProps) {
  if (hasDraft && publishedCount === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <FileEdit size={9} />
        Draft
      </span>
    );
  }
  if (hasDraft) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <FileEdit size={9} />
        Draft · v{publishedCount}
      </span>
    );
  }
  if (publishedCount > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <Lock size={9} />
        v{publishedCount}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
      New
    </span>
  );
}
```

- [ ] **Step 2: Verify type check + build**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npm run build`
Expected: "Compiled successfully"

- [ ] **Step 3: Commit**

```bash
git add components/projects/ProjectStatusPill.tsx
git commit -m "feat(projects): add ProjectStatusPill primitive"
```

---

## Task 3: Extract `NewProjectModal`

**Files:**
- Create: `components/projects/NewProjectModal.tsx`
- Modify: `components/ProjectsListPage.tsx` (delete the inline component, import the new file)

**Context:** The monolith has an inline `NewProjectModal` (lines ~166–256) that creates a project and dispatches `onCreate(name)`. Pure extraction — zero behavior change.

- [ ] **Step 1: Create `components/projects/NewProjectModal.tsx`**

Copy the entire inline implementation from `components/ProjectsListPage.tsx` (the function and its `NewProjectModalProps` interface) into the new file. Convert the function to a named export. Imports needed at the top:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';

export interface NewProjectModalProps {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function NewProjectModal({ onClose, onCreate }: NewProjectModalProps) {
  // body copied verbatim from the existing inline definition
}
```

The body is copied verbatim — do not refactor.

- [ ] **Step 2: Replace inline component with import in `components/ProjectsListPage.tsx`**

Delete the inline `function NewProjectModal(...)` block and the `NewProjectModalProps` interface above it. Add to imports:

```tsx
import { NewProjectModal } from '@/components/projects/NewProjectModal';
```

The existing usage `{showCreateModal && <NewProjectModal …>}` continues to compile because the named export shape matches.

- [ ] **Step 3: Verify type check + build**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npm run build`
Expected: "Compiled successfully"

- [ ] **Step 4: Commit**

```bash
git add components/projects/NewProjectModal.tsx components/ProjectsListPage.tsx
git commit -m "refactor(projects): extract NewProjectModal to its own file"
```

---

## Task 4: Move `DeleteProjectModal` into `components/projects/`

**Files:**
- Move: `components/DeleteProjectModal.tsx` → `components/projects/DeleteProjectModal.tsx`
- Modify: `components/ProjectsListPage.tsx` (update import path)

**Context:** All other project-specific components live under `components/projects/`. Move the existing `DeleteProjectModal` for consistency.

- [ ] **Step 1: Move the file**

```bash
git mv components/DeleteProjectModal.tsx components/projects/DeleteProjectModal.tsx
```

- [ ] **Step 2: Update the import in `components/ProjectsListPage.tsx`**

Replace:
```tsx
import DeleteProjectModal from '@/components/DeleteProjectModal';
```
With:
```tsx
import DeleteProjectModal from '@/components/projects/DeleteProjectModal';
```

If any other file in the repo imports `DeleteProjectModal` from the old path, update those too. Verify with:

```bash
grep -rn "from '@/components/DeleteProjectModal'" /Users/sunil/Development/github/layers
```

Update every match.

- [ ] **Step 3: Verify type check + build**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npm run build`
Expected: "Compiled successfully"

- [ ] **Step 4: Commit**

```bash
git add -A components/DeleteProjectModal.tsx components/projects/DeleteProjectModal.tsx components/ProjectsListPage.tsx
git commit -m "refactor(projects): move DeleteProjectModal under components/projects/"
```

---

## Task 5: Build `VersionList`

**Files:**
- Create: `components/projects/VersionList.tsx`

**Context:** Extract the version-list portion of the existing inline `SideSheet` (lines ~432–556 of the monolith). This includes the draft row, published rows, checkout button (only on latest published when no draft), diff selection mode, and the diff-mode footer. The side-sheet shell (Task 6) imports this.

The `SideSheet` currently owns these pieces of state — keep them inside `VersionList`:
- `versions: DiagramVersion[]` (fetched on mount)
- `loading: boolean`
- `isDiffMode: boolean`
- `diffSelections: string[]`
- `checkingOut: string | null`
- `checkoutError: string | null`
- `draftConflictDiagramId: string | null`

`VersionList` owns the version fetch, diff selection, checkout flow, and renders all version-related banners. The side-sheet shell only needs to pass `projectId`, `hasDraft`, and a small set of callbacks.

- [ ] **Step 1: Create `components/projects/VersionList.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Circle, FileEdit, GitBranch, GitCompare, Loader2, Lock,
} from 'lucide-react';
import {
  apiCheckoutVersion, apiListProjectVersions,
  DraftExistsError, type DiagramVersion,
} from '@/lib/api';
import { formatRelativeDate } from '@/lib/projectBadges';

export interface VersionListProps {
  projectId: string;
  hasDraft: boolean;
  onNavigate: (projectId: string) => void;
  onView: (projectId: string, diagramId: string) => void;
  onDiff: (projectId: string, base: DiagramVersion, compare: DiagramVersion) => void;
  /** External signal to enter diff mode (driven by side-sheet "Compare" button). */
  isDiffMode: boolean;
  onExitDiffMode: () => void;
}

export function VersionList({
  projectId, hasDraft, onNavigate, onView, onDiff, isDiffMode, onExitDiffMode,
}: VersionListProps) {
  const [versions, setVersions] = useState<DiagramVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [diffSelections, setDiffSelections] = useState<string[]>([]);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [draftConflictDiagramId, setDraftConflictDiagramId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setVersions([]);
    setCheckoutError(null);
    setDraftConflictDiagramId(null);
    setCheckingOut(null);
    setDiffSelections([]);
    apiListProjectVersions(projectId)
      .then((v) => setVersions([...v].reverse()))
      .catch(() => setCheckoutError('Failed to load versions'))
      .finally(() => setLoading(false));
  }, [projectId]);

  // Reset selections when diff mode toggles off externally
  useEffect(() => {
    if (!isDiffMode) setDiffSelections([]);
  }, [isDiffMode]);

  const handleCheckout = useCallback(async (versionId: string) => {
    setCheckoutError(null);
    setDraftConflictDiagramId(null);
    setCheckingOut(versionId);
    try {
      await apiCheckoutVersion(projectId, versionId);
      onNavigate(projectId);
    } catch (e) {
      if (e instanceof DraftExistsError) {
        setDraftConflictDiagramId(e.existingDraftId);
      } else {
        setCheckoutError(e instanceof Error ? e.message : 'Checkout failed');
      }
    } finally {
      setCheckingOut(null);
    }
  }, [projectId, onNavigate]);

  const toggleDiffSelection = (id: string) => {
    setDiffSelections((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  };

  const handleRunDiff = () => {
    if (diffSelections.length !== 2) return;
    const [id1, id2] = diffSelections;
    const v1 = published.find((v) => v.id === id1);
    const v2 = published.find((v) => v.id === id2);
    if (!v1 || !v2) return;
    const [base, compare] =
      (v1.versionNumber ?? 0) <= (v2.versionNumber ?? 0) ? [v1, v2] : [v2, v1];
    onDiff(projectId, base, compare);
  };

  const draft = versions.find((v) => v.status === 'draft');
  const published = versions.filter((v) => v.status === 'published');
  const latestPublishedId = published[0]?.id;

  return (
    <div className="flex flex-col">
      {/* Diff mode instruction banner */}
      {isDiffMode && (
        <div className="border-y border-blue-100 bg-blue-50 px-5 py-2.5 dark:border-blue-900 dark:bg-blue-900/10">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Select <strong>2 published versions</strong> to compare.
            {diffSelections.length > 0 && (
              <span className="ml-1 font-medium">{diffSelections.length}/2 selected</span>
            )}
          </p>
        </div>
      )}

      {/* Open draft CTA */}
      {!isDiffMode && hasDraft && draft && (
        <div className="border-y border-slate-100 bg-amber-50 px-5 py-3 dark:border-slate-800 dark:bg-amber-900/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <FileEdit size={14} />
              <span>Draft in progress</span>
            </div>
            <button
              onClick={() => onNavigate(projectId)}
              className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
            >
              Open Draft
            </button>
          </div>
        </div>
      )}

      {/* Draft conflict banner */}
      {draftConflictDiagramId && (
        <div className="border-y border-amber-200 bg-amber-50 px-5 py-3 dark:border-amber-900 dark:bg-amber-900/10">
          <p className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-300">
            A draft already exists for this project.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { setDraftConflictDiagramId(null); onNavigate(projectId); }}
              className="flex-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
            >
              Open existing draft
            </button>
            <button
              onClick={() => setDraftConflictDiagramId(null)}
              className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:text-amber-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Checkout error */}
      {checkoutError && (
        <div className="border-y border-red-100 bg-red-50 px-5 py-2.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/10 dark:text-red-400">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={12} />
            {checkoutError}
          </div>
        </div>
      )}

      {/* Versions */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            Loading versions…
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <GitBranch size={28} className="text-slate-300 dark:text-slate-600" />
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No content yet</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Open the editor to start building your diagram.
              </p>
            </div>
            <button
              onClick={() => onNavigate(projectId)}
              className="mt-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Go to Editor
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {draft && !isDiffMode && (
              <li className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <FileEdit size={9} />
                      Working Draft
                    </span>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Last saved {formatRelativeDate(draft.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => onNavigate(projectId)}
                    className="flex-shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-400"
                  >
                    Open
                  </button>
                </div>
              </li>
            )}

            {published.map((v) => {
              const isSelected = diffSelections.includes(v.id);
              const canSelect = isSelected || diffSelections.length < 2;
              return (
                <li
                  key={v.id}
                  className={`px-5 py-3.5 transition-colors ${
                    isDiffMode
                      ? isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/15'
                        : canSelect
                        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        : 'opacity-40'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <Lock size={9} />
                          v{v.versionNumber}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {v.publishedAt ? formatRelativeDate(v.publishedAt) : '—'}
                        </span>
                      </div>
                      {v.publishComment && (
                        <p className="mt-1 truncate text-xs italic text-slate-500 dark:text-slate-400">
                          &ldquo;{v.publishComment}&rdquo;
                        </p>
                      )}
                    </div>

                    {isDiffMode ? (
                      <button
                        onClick={() => canSelect && toggleDiffSelection(v.id)}
                        disabled={!canSelect}
                        className="flex-shrink-0 rounded-lg p-1 transition-colors"
                      >
                        {isSelected ? (
                          <CheckCircle2 size={18} className="text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Circle size={18} className="text-slate-300 dark:text-slate-600" />
                        )}
                      </button>
                    ) : (
                      <div className="flex flex-shrink-0 flex-col gap-1.5">
                        <button
                          onClick={() => onView(projectId, v.id)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          View
                        </button>
                        {!draft && v.id === latestPublishedId && (
                          <button
                            onClick={() => handleCheckout(v.id)}
                            disabled={!!checkingOut}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-400"
                          >
                            {checkingOut === v.id ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              'Check Out'
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Diff mode footer */}
      {isDiffMode && (
        <div className="border-t border-slate-200 bg-white px-5 py-3.5 dark:border-slate-700 dark:bg-slate-900">
          <button
            disabled={diffSelections.length !== 2}
            onClick={handleRunDiff}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <GitCompare size={14} />
            {diffSelections.length === 2
              ? 'Compare Selected Versions'
              : `Select ${2 - diffSelections.length} more version${diffSelections.length === 0 ? 's' : ''}`}
          </button>
          <button
            onClick={onExitDiffMode}
            className="mt-2 w-full rounded-lg px-3 py-1 text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Cancel compare
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify type check + build**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npm run build`
Expected: "Compiled successfully"

- [ ] **Step 3: Commit**

```bash
git add components/projects/VersionList.tsx
git commit -m "feat(projects): add VersionList with checkout, diff, and conflict handling"
```

---

## Task 6: Build `ProjectSideSheet`

**Files:**
- Create: `components/projects/ProjectSideSheet.tsx`

**Context:** New side-sheet shell that absorbs name/description editing and embeds `VersionList`. Replaces the inline `SideSheet` from the monolith. Spec §4.

The side-sheet does NOT delete projects directly — it surfaces a `Delete project` button in a danger zone that calls back up to the page; the page owns the `DeleteProjectModal` state.

- [ ] **Step 1: Create `components/projects/ProjectSideSheet.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle, GitCompare, Loader2, Pencil, Trash2, X,
} from 'lucide-react';
import {
  apiUpdateProject,
  type ProjectWithVersioning, type DiagramVersion,
} from '@/lib/api';
import { formatRelativeDate } from '@/lib/projectBadges';
import { VersionList } from '@/components/projects/VersionList';

export interface ProjectSideSheetProps {
  project: ProjectWithVersioning;
  onClose: () => void;
  onNavigate: (projectId: string) => void;
  onView: (projectId: string, diagramId: string) => void;
  onDiff: (projectId: string, base: DiagramVersion, compare: DiagramVersion) => void;
  /** Bubbles a saved-rename / saved-description back to the page so the table updates. */
  onProjectChanged: (next: ProjectWithVersioning) => void;
  /** Asks the page to open the delete confirm modal for this project. */
  onRequestDelete: (project: ProjectWithVersioning) => void;
}

export function ProjectSideSheet({
  project, onClose, onNavigate, onView, onDiff, onProjectChanged, onRequestDelete,
}: ProjectSideSheetProps) {
  const [editingName, setEditingName] = useState(false);
  const [pendingName, setPendingName] = useState(project.name);
  const [editingDescription, setEditingDescription] = useState(false);
  const [pendingDescription, setPendingDescription] = useState(project.description ?? '');
  const [savingField, setSavingField] = useState<'name' | 'description' | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDiffMode, setIsDiffMode] = useState(false);

  // Sync local edit buffers when a different project is selected.
  useEffect(() => {
    setEditingName(false);
    setEditingDescription(false);
    setPendingName(project.name);
    setPendingDescription(project.description ?? '');
    setSaveError(null);
    setIsDiffMode(false);
  }, [project.id, project.name, project.description]);

  const handleSaveName = async () => {
    const trimmed = pendingName.trim();
    if (!trimmed || trimmed === project.name) {
      setEditingName(false);
      setPendingName(project.name);
      return;
    }
    setSavingField('name');
    setSaveError(null);
    try {
      const updated = await apiUpdateProject(project.id, { name: trimmed });
      onProjectChanged({ ...project, name: updated.name });
      setEditingName(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save name');
      setPendingName(project.name);
    } finally {
      setSavingField(null);
    }
  };

  const handleSaveDescription = async () => {
    const next = pendingDescription;
    if (next === (project.description ?? '')) {
      setEditingDescription(false);
      return;
    }
    setSavingField('description');
    setSaveError(null);
    try {
      const updated = await apiUpdateProject(project.id, { description: next });
      onProjectChanged({ ...project, description: updated.description });
      setEditingDescription(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save description');
      setPendingDescription(project.description ?? '');
    } finally {
      setSavingField(null);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-96 flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div className="min-w-0 flex-1 pr-3">
          {editingName ? (
            <input
              autoFocus
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSaveName(); }
                if (e.key === 'Escape') { setEditingName(false); setPendingName(project.name); }
              }}
              disabled={savingField === 'name'}
              className="w-full rounded-lg border border-blue-400 bg-white px-2 py-0.5 text-base font-bold text-slate-900 outline-none ring-2 ring-blue-100 dark:border-blue-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-blue-900/40"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="flex w-full items-center gap-1.5 text-left text-base font-bold text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
              title="Click to rename"
            >
              <span className="truncate">{project.name}</span>
              <Pencil size={11} className="flex-shrink-0 text-slate-400 opacity-0 group-hover:opacity-100" />
            </button>
          )}
          <p className="mt-0.5 text-xs text-slate-400">
            Created {formatRelativeDate(project.createdAt)}
            {' · '}Last updated {formatRelativeDate(project.updatedAt)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <X size={16} />
        </button>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-2.5 dark:border-slate-800">
        <button
          onClick={() => onNavigate(project.id)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          Open
        </button>
        <button
          onClick={() => setIsDiffMode((v) => !v)}
          disabled={isDiffMode}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-blue-700 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
        >
          <GitCompare size={12} />
          Compare
        </button>
      </div>

      {/* Save error */}
      {saveError && (
        <div className="flex items-center gap-1.5 border-b border-red-100 bg-red-50 px-5 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/10 dark:text-red-400">
          <AlertCircle size={12} />
          {saveError}
        </div>
      )}

      {/* Body — About + Versions + Danger zone */}
      <div className="flex-1 overflow-y-auto">
        {/* About */}
        <section className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">About</h3>

          {editingDescription ? (
            <>
              <textarea
                autoFocus
                rows={4}
                value={pendingDescription}
                onChange={(e) => setPendingDescription(e.target.value)}
                disabled={savingField === 'description'}
                placeholder="Add a description…"
                className="w-full rounded-lg border border-blue-400 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none ring-2 ring-blue-100 dark:border-blue-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-blue-900/40"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={handleSaveDescription}
                  disabled={savingField === 'description'}
                  className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingField === 'description'
                    ? <Loader2 size={11} className="animate-spin" />
                    : 'Save'}
                </button>
                <button
                  onClick={() => { setEditingDescription(false); setPendingDescription(project.description ?? ''); }}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setEditingDescription(true)}
              className="block w-full rounded-lg border border-transparent px-2 py-1.5 text-left text-sm hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/50"
              title="Click to edit description"
            >
              {project.description
                ? <span className="text-slate-700 dark:text-slate-300">{project.description}</span>
                : <span className="italic text-slate-400 dark:text-slate-500">Add a description…</span>}
            </button>
          )}
        </section>

        {/* Versions */}
        <section>
          <h3 className="px-5 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Versions</h3>
          <VersionList
            projectId={project.id}
            hasDraft={project.hasDraft}
            onNavigate={onNavigate}
            onView={onView}
            onDiff={onDiff}
            isDiffMode={isDiffMode}
            onExitDiffMode={() => setIsDiffMode(false)}
          />
        </section>

        {/* Danger zone */}
        <section className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Danger zone</h3>
          <button
            onClick={() => onRequestDelete(project)}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400"
          >
            <Trash2 size={12} />
            Delete project
          </button>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify type check + build**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npm run build`
Expected: "Compiled successfully"

- [ ] **Step 3: Commit**

```bash
git add components/projects/ProjectSideSheet.tsx
git commit -m "feat(projects): add ProjectSideSheet with name/description editor + danger zone"
```

---

## Task 7: Build `ProjectsTable`

**Files:**
- Create: `components/projects/ProjectsTable.tsx`

**Context:** Pure rendering component. Receives the filtered project list + selection state + callbacks. Drops the inline rename (it now lives in the side-sheet — Task 6). Drops the inline `Pencil` action button. Keeps the `Trash2` action that opens the delete confirm.

- [ ] **Step 1: Create `components/projects/ProjectsTable.tsx`**

```tsx
'use client';

import { ChevronRight, Clock, FolderOpen, Trash2 } from 'lucide-react';
import { projectColor, formatRelativeDate } from '@/lib/projectBadges';
import { ProjectStatusPill } from '@/components/projects/ProjectStatusPill';
import type { ProjectWithVersioning } from '@/lib/api';

export interface ProjectsTableProps {
  projects: ProjectWithVersioning[];
  selectedId: string | null;
  onSelect: (project: ProjectWithVersioning) => void;
  onRequestDelete: (project: ProjectWithVersioning) => void;
}

export function ProjectsTable({ projects, selectedId, onSelect, onRequestDelete }: ProjectsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
            <Th>Name</Th>
            <Th>Created</Th>
            <Th>Last updated</Th>
            <Th>Status</Th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {projects.map((p) => (
            <tr
              key={p.id}
              onClick={() => onSelect(p)}
              className={`group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                selectedId === p.id ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''
              }`}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${projectColor(p.id).bg} ${projectColor(p.id).text}`}>
                    <FolderOpen size={14} />
                  </div>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{p.name}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Clock size={11} />
                  {formatRelativeDate(p.createdAt)}
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatRelativeDate(p.updatedAt)}
                </span>
              </td>
              <td className="px-4 py-3">
                <ProjectStatusPill hasDraft={p.hasDraft} publishedCount={p.publishedCount} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    title="Delete project"
                    onClick={(e) => { e.stopPropagation(); onRequestDelete(p); }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                  <ChevronRight size={14} className="ml-1 text-slate-300 dark:text-slate-600" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {children}
    </th>
  );
}
```

- [ ] **Step 2: Verify type check + build**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npm run build`
Expected: "Compiled successfully"

- [ ] **Step 3: Commit**

```bash
git add components/projects/ProjectsTable.tsx
git commit -m "feat(projects): add ProjectsTable with row click to side-sheet"
```

---

## Task 8: Rebuild `ProjectsListPage`

**Files:**
- Modify (rewrite): `components/ProjectsListPage.tsx`

**Context:** The orchestrator. After Tasks 1–7 the file still carries the `InfoPanel`, `StatusBadge`, inline `SideSheet`, inline rename state, and inline filter pills/search. This task rewrites the file end-to-end. ~200 lines.

The new file:
- Drops `InfoPanel` entirely
- Drops `StatusBadge` (replaced by `ProjectStatusPill` inside `ProjectsTable`)
- Drops inline `SideSheet` (replaced by `ProjectSideSheet`)
- Drops inline rename state and handlers
- Adds URL sync for `q` and `status`
- Uses the comfortable-density `ProjectsTable`
- Resyncs `selectedProject` after every list refetch (closes the side-sheet if the project disappeared)

- [ ] **Step 1: Replace the whole file**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity, AlertCircle, FolderOpen, LayoutDashboard, Loader2, LogOut, Monitor, Moon, Plus,
  Search, Sun, User,
} from 'lucide-react';
import LayersLogo from '@/components/LayersLogo';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import DeleteProjectModal from '@/components/projects/DeleteProjectModal';
import { NewProjectModal } from '@/components/projects/NewProjectModal';
import { ProjectsTable } from '@/components/projects/ProjectsTable';
import { ProjectSideSheet } from '@/components/projects/ProjectSideSheet';
import {
  apiCreateProject, apiListProjects,
  type ProjectWithVersioning, type DiagramVersion,
} from '@/lib/api';
import { isLoggedIn, getStoredUser, signOut } from '@/lib/authStore';
import { useTheme } from '@/lib/themeContext';

type StatusFilter = 'all' | 'draft' | 'published';

export default function ProjectsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();

  const [projects, setProjects] = useState<ProjectWithVersioning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectWithVersioning | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectWithVersioning | null>(null);
  const [user, setUser] = useState<{ name?: string | null; email: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get('status') as StatusFilter | null) ?? 'all',
  );

  // ── Initial auth + list load ───────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return; }
    const stored = getStoredUser();
    if (stored) setUser({ name: stored.name, email: stored.email });
    apiListProjects()
      .then(setProjects)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load projects'))
      .finally(() => setLoading(false));
  }, [router]);

  // ── URL sync (immediate) ───────────────────────────────────────────────────
  useEffect(() => {
    const qs = new URLSearchParams();
    if (searchQuery) qs.set('q', searchQuery);
    if (statusFilter !== 'all') qs.set('status', statusFilter);
    const next = qs.toString();
    router.replace(`/projects${next ? `?${next}` : ''}`);
  }, [searchQuery, statusFilter, router]);

  // ── Resync selectedProject after every list change ─────────────────────────
  useEffect(() => {
    if (!selectedProject) return;
    const fresh = projects.find((p) => p.id === selectedProject.id);
    if (!fresh) {
      setSelectedProject(null); // project deleted — close side-sheet
    } else if (fresh !== selectedProject) {
      setSelectedProject(fresh);
    }
  }, [projects, selectedProject]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const handleCreate = useCallback(async (name: string) => {
    await apiCreateProject(name);
    const updated = await apiListProjects();
    setProjects(updated);
    setShowCreateModal(false);
  }, []);

  const handleNavigate = useCallback((projectId: string) => {
    router.push(`/projects/${projectId}`);
  }, [router]);

  const handleView = useCallback((projectId: string, diagramId: string) => {
    router.push(`/projects/${projectId}?view=${diagramId}`);
  }, [router]);

  const handleDiff = useCallback(
    (projectId: string, base: DiagramVersion, compare: DiagramVersion) => {
      const pc1 = base.publishComment ? encodeURIComponent(base.publishComment) : '';
      const pc2 = compare.publishComment ? encodeURIComponent(compare.publishComment) : '';
      router.push(
        `/diff?projectId=${projectId}&v1=${base.id}&vn1=${base.versionNumber ?? ''}&pc1=${pc1}&v2=${compare.id}&vn2=${compare.versionNumber ?? ''}&pc2=${pc2}`,
      );
    },
    [router],
  );

  const handleProjectChanged = useCallback((next: ProjectWithVersioning) => {
    setProjects((prev) => prev.map((p) => p.id === next.id ? next : p));
  }, []);

  const handleDeleted = useCallback((projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setDeleteTarget(null);
    // The selectedProject resync effect will close the side-sheet.
  }, []);

  const cycleTheme = () => {
    const cycle = ['light', 'dark', 'system'] as const;
    setTheme(cycle[(cycle.indexOf(theme) + 1) % cycle.length]);
  };

  // ── Filtering (client-side) ────────────────────────────────────────────────
  const filteredProjects = projects
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((p) => {
      if (statusFilter === 'draft') return p.hasDraft;
      if (statusFilter === 'published') return !p.hasDraft && p.publishedCount > 0;
      return true;
    });

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <header className="flex h-9 flex-shrink-0 items-center border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="mr-4 flex items-center gap-1.5 pl-1">
          <LayersLogo size={14} className="text-blue-600" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Layers</span>
        </div>
        <button
          onClick={() => router.push('/home')}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          <LayoutDashboard size={13} />
          <span className="hidden sm:inline">Home</span>
        </button>
        <button
          onClick={() => router.push('/activity')}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          <Activity size={13} />
          <span className="hidden sm:inline">AI Activity</span>
        </button>
        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={cycleTheme}
            title={`Theme: ${theme} — click to cycle`}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            {theme === 'light' ? <Sun size={14} /> : theme === 'dark' ? <Moon size={14} /> : <Monitor size={14} />}
            <span className="hidden sm:inline capitalize">{theme}</span>
          </button>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
          {user && (
            <button
              onClick={() => { signOut(); router.push('/login'); }}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              title="Sign out"
            >
              <User size={13} className="text-slate-500 dark:text-slate-400" />
              <span className="max-w-[140px] truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</span>
              <LogOut size={12} className="text-slate-400 dark:text-slate-500" />
            </button>
          )}
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="flex-shrink-0 border-b border-red-100 bg-red-50 px-5 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/10 dark:text-red-400">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={14} />
            {error}
          </div>
        </div>
      )}

      <main className="flex flex-1 flex-col overflow-auto">
        {/* Sub-header strip */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100">My Projects</h1>
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            className="h-8 px-3 py-0 text-xs"
          >
            <Plus size={13} />
            New Project
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            Loading…
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6 py-12">
            <EmptyState
              icon={<FolderOpen size={28} />}
              heading="No projects yet"
              subtext="Create your first project to start mapping threats."
              cta={
                <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                  <Plus size={13} />
                  Create your first project
                </Button>
              }
            />
          </div>
        ) : (
          <div className="px-5 py-5">
            {/* Toolbar row: search + status filter + result count */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects…"
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-600 dark:focus:ring-indigo-900/30"
                />
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
                {(['all', 'draft', 'published'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                      statusFilter === f
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
                {filteredProjects.length} of {projects.length}
              </span>
            </div>

            {filteredProjects.length === 0 ? (
              <div className="py-12">
                <EmptyState
                  icon={<Search size={24} />}
                  heading="No projects match your filters"
                  subtext="Try adjusting or clearing your filters."
                  cta={
                    <Button
                      variant="secondary"
                      onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              </div>
            ) : (
              <ProjectsTable
                projects={filteredProjects}
                selectedId={selectedProject?.id ?? null}
                onSelect={setSelectedProject}
                onRequestDelete={setDeleteTarget}
              />
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreateModal && (
        <NewProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}

      {deleteTarget && (
        <DeleteProjectModal
          project={{ id: deleteTarget.id, name: deleteTarget.name }}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}

      {/* Side sheet */}
      {selectedProject && (
        <>
          <div
            className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-[1px]"
            onClick={() => setSelectedProject(null)}
          />
          <ProjectSideSheet
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
            onNavigate={handleNavigate}
            onView={handleView}
            onDiff={handleDiff}
            onProjectChanged={handleProjectChanged}
            onRequestDelete={setDeleteTarget}
          />
        </>
      )}
    </div>
  );
}
```

If the existing `Button` primitive doesn't accept `<Plus size={13} />` as a child, replace those `<Button>` usages with the original raw `<button>` markup that the monolith used (preserves visual consistency). Verify by reading `components/ui/Button.tsx`.

If the existing `EmptyState` primitive's prop names differ from `{ icon, heading, subtext, cta }`, adapt the call sites to match the actual props. Verify by reading `components/ui/EmptyState.tsx`.

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: "Compiled successfully"

- [ ] **Step 4: Manual verify**

Start the dev server (`npm run dev`), log in, open `/projects`. Confirm:
- Top bar matches secondary-page chrome (Layers logo, Home, AI Activity, theme cycle, user)
- No left InfoPanel sidebar
- Sub-header strip shows "My Projects" + "New Project" button
- Search input updates URL immediately (`?q=…`)
- Status filter pills update URL (`?status=draft` etc.); refresh persists
- Project rows show comfortable density with `ProjectStatusPill` (Draft / v{n} / Draft · v{n} / New)
- Click row opens side-sheet
- Side-sheet allows click-to-edit name (Enter/blur saves) and click-to-edit description (Save/Cancel)
- Delete button in danger zone opens the existing `DeleteProjectModal`; on confirm, side-sheet closes
- Compare button toggles diff mode; selecting two published versions enables Compare button → opens diff route
- Empty state renders with primary CTA when 0 projects exist
- "No projects match" empty state appears when filters return 0
- Both light + dark mode look correct

- [ ] **Step 5: Commit**

```bash
git add components/ProjectsListPage.tsx
git commit -m "feat(projects): rebuild orchestrator with URL sync and side-sheet rename/description"
```

---

## Final verification

After Task 8 lands:

- [ ] **Branch type check + build clean**

```bash
npx tsc --noEmit
npm run build
```

Both must pass.

- [ ] **Push branch + open PR to main**

```bash
git push -u origin feat/projects-list-redesign
gh pr create --title "feat: projects list redesign" --body "$(cat <<'EOF'
## Summary
- Replace 967-line ProjectsListPage monolith with focused per-component files under components/projects/
- Drop the static InfoPanel sidebar
- Move project rename + description editing into the side-sheet (no more inline rename in the table)
- URL-sync search and status filter
- Replace hand-rolled StatusBadge with ProjectStatusPill
- Centralize projectColor + formatRelativeDate in lib/projectBadges

## Test plan
- [ ] Manual smoke on /projects: search + filter + URL sync (refresh-safe)
- [ ] Side-sheet rename + description edit (success + failure paths)
- [ ] Side-sheet checkout (latest published only when no draft)
- [ ] Side-sheet diff (compare two published versions)
- [ ] Side-sheet delete (confirm modal + close)
- [ ] Empty state when 0 projects, "no matches" when filters exclude all
- [ ] Light + dark mode

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of scope (deferred)

- Project tag filtering / search by tag
- Bulk actions (multi-select rows, bulk delete / move)
- Archive (soft-delete) state for projects
- Public / shared projects UI
- Card layout with thumbnails (requires backend extension)
- Tests — no test infrastructure in this repo today
