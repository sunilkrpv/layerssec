# Projects List — UX Redesign Spec

**Date:** 2026-04-27
**Status:** Approved (pending plan)
**Owners:** Frontend (Layers)
**Related:** `feat/ux-foundations` (shared primitives), `feat/ux-diagram-chrome`, `feat/threats-dashboard-redesign` (chrome conventions)

---

## Goal

Replace the existing 967-line `ProjectsListPage` monolith with a clearer, more focused UX that adopts the chrome conventions and shared UI primitives established in the diagram-chrome and threats-dashboard migrations. Drop the static onboarding `InfoPanel`, move project rename + description editing into the side-sheet, URL-sync the search and status filter, and split the monolith into focused per-component files.

---

## Decisions

| Topic | Decision |
|-------|----------|
| Layout | Table — keep current pattern; comfortable density |
| Version history | Side-sheet — keep right-docked overlay; no new route |
| `InfoPanel` | Drop entirely — content redundant with home dashboard |
| Filter pattern | Three-pill toggle (`All` / `Draft` / `Published`) — keep current chip pattern |
| Sub-header | Keep separate strip with "My Projects" title + `+ New Project` button |
| Inline rename | Move to side-sheet — alongside description editing and version history |
| URL sync | Sync both `q` (search) and `status` (filter) — matches Threats Dashboard |
| Delivery | Big-bang rewrite on a single feature branch via subagent-driven plan |

---

## 1. Routes + page-level structure

Single existing route — `/projects` (`app/projects/page.tsx`). No new routes; the version-history side-sheet stays an inline overlay.

**Page chrome (top to bottom):**
1. **Top bar** (`h-9`, secondary-page convention): Layers logo, Home + AI Activity nav buttons, vertical divider, right cluster (theme cycle + user/sign-out)
2. **Error banner** (only when an error is set): red strip below the top bar
3. **Sub-header strip**: "My Projects" title + `+ New Project` primary button
4. **Toolbar row**: search input + 3-pill status toggle (`All` / `Draft` / `Published`) + result count (right-aligned)
5. **Projects table**: comfortable rows, columns Name (color folder badge + name) / Created / Last updated / Status pill / actions (`⋯` menu)
6. **Empty state** when 0 projects (no filters) or 0 matches (with filters) — `EmptyState` primitive

**Side-sheet** (right-docked overlay, `w-96` ≈ 384px, fixed):
- Header: project name (h2, click to edit) + `Created` + `Last updated` line + Close (✕)
- Action row: `Open` button (navigate to `/projects/:id`) · `Compare` toggle (only when ≥ 2 published) · `⋯` overflow menu (Delete)
- Body sections: **About** (name + description editor) → **Versions** (draft + published rows with checkout / diff actions) → **Danger zone** (Delete CTA)
- Outside-click closes; URL is unchanged

---

## 2. Component breakdown

| File | Approx. lines | Purpose |
|------|---------------|---------|
| `components/ProjectsListPage.tsx` | ~200 | Orchestrator — page chrome, URL sync, list state, modal triggers, refetch on mutation |
| `components/projects/ProjectsTable.tsx` | ~140 | Table rendering, color folder badge, status pill, actions menu, click → open side-sheet |
| `components/projects/ProjectSideSheet.tsx` | ~250 | Side-sheet shell — header, About editor, embeds VersionList, danger zone |
| `components/projects/VersionList.tsx` | ~120 | Draft + published rows, checkout, draft-conflict + checkout error UI, diff selection mode |
| `components/projects/NewProjectModal.tsx` | ~80 | Existing — extracted as-is from monolith |
| `components/projects/DeleteProjectModal.tsx` | (existing) | Move from `components/DeleteProjectModal.tsx` into `components/projects/` |
| `lib/projectBadges.ts` | ~50 | Shared `projectColor(id)` palette helper + `formatRelativeDate(iso)` (renamed from local `formatDate`) |

**Drop entirely:**
- `InfoPanel` (~100 lines static onboarding sidebar)
- Inline `StatusBadge` component — replaced by `StatusPill` from `components/ui/`

**Primitives reused:** `Button`, `IconButton`, `EmptyState`, `Tooltip`, `StatusPill`, `DropdownMenu` (for row `⋯` actions menu).

**`StatusBadge` → `ProjectStatusPill` mapping:**

The current `StatusBadge` renders three states based on `(hasDraft, publishedCount)` with project-specific copy ("Draft", "Published", "Draft + Published"). The shared `StatusPill` `status` variant uses threat-specific labels (`open`, `in-review`, `mitigated`, `dismissed`, `accepted`) which do not read correctly on a project. Create a thin local component:

`components/projects/ProjectStatusPill.tsx` (~40 lines) — a tiny wrapper that uses the same colour tokens as `StatusPill` (slate / amber / green) but renders project-appropriate labels:

| Project state | Label | Tone |
|---------------|-------|------|
| `hasDraft && publishedCount === 0` | "Draft" | amber |
| `hasDraft && publishedCount > 0` | "Draft · v{n}" | amber + slate |
| `!hasDraft && publishedCount > 0` | "v{n}" | green |
| `!hasDraft && publishedCount === 0` | "New" | slate |

The wrapper is local to `components/projects/`. The hand-rolled inline `StatusBadge` in the monolith is deleted in the same task.

---

## 3. State + data flow

### Page state

```ts
const [projects, setProjects] = useState<ProjectWithVersioning[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>(
  (searchParams.get('status') as 'all' | 'draft' | 'published' | null) ?? 'all'
);
const [selectedProject, setSelectedProject] = useState<ProjectWithVersioning | null>(null);
const [showCreateModal, setShowCreateModal] = useState(false);
const [deleteTarget, setDeleteTarget] = useState<ProjectWithVersioning | null>(null);
```

### URL sync (immediate, no debounce)

On every change to `searchQuery` or `statusFilter`, write the URL via `router.replace`:

- `q` empty → drop from URL
- `status === 'all'` → drop from URL
- otherwise: `?q=${searchQuery}&status=${statusFilter}`

Reading: on mount, `useSearchParams()` seeds initial state.

### Filtering

Client-side. The `apiListProjects` endpoint returns all of the user's projects (no pagination today), and each row carries its own `hasDraft` / `publishedCount`. Apply filters in the table render:

```ts
const filtered = projects
  .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  .filter((p) => {
    if (statusFilter === 'draft') return p.hasDraft;
    if (statusFilter === 'published') return !p.hasDraft && p.publishedCount > 0;
    return true;
  });
```

### Refresh on mutation

After `apiCreateProject`, `apiUpdateProject`, or `apiDeleteProject`, refetch via `apiListProjects`. A `useEffect` keyed on `projects` then resyncs `selectedProject` by id — find the same project in the new array, replace the local state. If the selected project no longer exists in the refetched list (was just deleted), the effect calls `setSelectedProject(null)` which closes the side-sheet.

Search and status filter state are NOT reset on refetch — they persist across mutations.

### Side-sheet local state (owned by `ProjectSideSheet`)

```ts
const [versions, setVersions] = useState<DiagramVersion[]>([]);
const [loadingVersions, setLoadingVersions] = useState(true);
const [pendingName, setPendingName] = useState(project.name);
const [pendingDescription, setPendingDescription] = useState(project.description ?? '');
const [savingField, setSavingField] = useState<'name' | 'description' | null>(null);
const [saveError, setSaveError] = useState<string | null>(null);
const [isDiffMode, setIsDiffMode] = useState(false);
const [diffSelections, setDiffSelections] = useState<string[]>([]);
const [checkingOut, setCheckingOut] = useState<string | null>(null);
const [checkoutError, setCheckoutError] = useState<string | null>(null);
const [draftConflictDiagramId, setDraftConflictDiagramId] = useState<string | null>(null);
```

The side-sheet calls `apiUpdateProject(id, { name })` or `apiUpdateProject(id, { description })` on save, then bubbles `onProjectChanged(updatedProject)` so the page can patch the row in the table.

### Open existing draft

When `apiCheckoutVersion` throws `DraftExistsError`, the side-sheet shows an amber banner with an "Open existing draft →" CTA that calls `onNavigate(projectId)` (no second checkout call — backend already has the draft).

---

## 4. Side-sheet UX

### Layout (right-docked)

```
┌─────────────────────────────────────────────┐
│  Project name (h2, click to edit)        ✕ │
│  Created Apr 12 · Last updated 2h ago       │
├─────────────────────────────────────────────┤
│  [Open ▸]  [Compare ▸]  [⋯]                 │
├─────────────────────────────────────────────┤
│  ABOUT                                      │
│  [name input — click to edit]               │
│  [description textarea — click to edit]     │
│  [Save] [Cancel]    (only when dirty)       │
├─────────────────────────────────────────────┤
│  VERSIONS                                   │
│  ⚪ Draft · updated 2h ago     [Open]       │
│  ─                                          │
│  v3 · published Apr 18                      │
│       "Added auth-svc"        [Check out]   │
│  v2 · published Apr 10        [Compare]     │
│  v1 · published Apr 5         [Compare]     │
├─────────────────────────────────────────────┤
│  ⚠ Danger zone                              │
│  [Delete project]                           │
└─────────────────────────────────────────────┘
```

### Edit semantics

- **Name** — h2 renders project name in display mode. Click OR pencil icon → swap to inline `<input>`. Enter saves; Esc cancels; blur saves. Save calls `apiUpdateProject(id, { name })`.
- **Description** — display mode renders read-only `<p>` with the description text, OR a placeholder ("Add a description…") in muted slate when null/empty. Click → swap to a 4-row `<textarea>` with explicit Save / Cancel buttons (no blur-to-save, since textareas typically need explicit confirmation). Save calls `apiUpdateProject(id, { description })`.
- On success for either field, the component calls `onProjectChanged(updatedProject)` so the page can patch the row in the table without a full refetch.
- During save, the field is disabled and a small `Loader2` spinner shows next to it.

### Versions list

- Draft row at top (when one exists): `Open` button → `onNavigate(projectId)`.
- Published versions in reverse-chronological order.
- **Check out** button is only enabled on the latest published version AND only when no draft exists. Other published rows show no checkout — they show the `Compare` checkbox when `isDiffMode` is on.
- `Compare` toggle in the action row: enables a checkbox on each published row. When exactly two are picked, a `Run diff` button activates and opens `/diff?v1=…&v2=…`.

### Delete

Click `Delete project` in the Danger zone → existing `DeleteProjectModal` opens for confirm. On confirm + success, the side-sheet closes and the table removes the row.

### Errors

- Checkout error → red inline banner above versions list with `Retry`.
- Draft conflict → amber inline banner with `Open existing draft →`.
- Rename / description save failure → red inline banner above the field with `Retry`.

---

## 5. Empty / loading / error states

| State | Surface |
|-------|---------|
| Initial load | Centered spinner in main area |
| 0 projects total (no filters) | `EmptyState` primitive: FolderOpen icon, "No projects yet" copy, `Create your first project` CTA → opens `NewProjectModal` |
| 0 matches for filter/search | `EmptyState`: "No projects match", `Clear filters` CTA → resets `q` + `status` to defaults |
| API error on list | Red banner above table; table still renders last-known data if any |
| Create success | Modal closes; refetch; new project appears in table (sorted by backend) |
| Delete success | Side-sheet closes if deleted project was selected; refetch |
| Rename / description save | Optimistic update; rollback on failure with red inline banner |

---

## 6. Backend dependency check

All flows use existing endpoints — no backend changes required:

- `apiListProjects(): ProjectWithVersioning[]` ✓
- `apiCreateProject(name, description?)` ✓
- `apiUpdateProject(id, { name?, description? })` ✓ (`Project.description: string | null` already on model)
- `apiDeleteProject(id)` ✓
- `apiListProjectVersions(projectId)` ✓
- `apiCheckoutVersion(projectId, versionId)` ✓ (throws `DraftExistsError` on 409 — already handled)

---

## 7. Out of scope

Deliberately deferred:

- Project tag filtering / search by tag
- Bulk actions (multi-select rows, bulk delete / move)
- Archive (soft-delete) state for projects
- Public / shared projects UI
- Card layout with thumbnails (requires backend extension to include thumbnails in list response)
- Tests — no test infrastructure in this repo today; manual verification only

---

## 8. Quality gates (per implementation task)

- `npx tsc --noEmit` → 0 errors
- `npm run build` → "Compiled successfully"
- **Do not** run `npm run lint` — pre-existing broken in Next 16 at the repo level.
- Manual: every visible surface verified in both light and dark mode (`html.dark` toggle).
