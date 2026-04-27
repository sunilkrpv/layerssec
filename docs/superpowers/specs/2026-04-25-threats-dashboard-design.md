# Threats Dashboard — UX Redesign Spec

**Date:** 2026-04-25
**Status:** Approved (pending plan)
**Owners:** Frontend (Layers)
**Related:** `feat/ux-foundations` (shared primitives), `feat/ux-diagram-chrome` (chrome conventions)

---

## Goal

Replace the existing 1406-line `ThreatsDashboardPage` monolith with a clearer, more focused UX optimized for **threat assessment review**. Adopt the chrome conventions and shared UI primitives established in the diagram-chrome migration so the threats experience feels like part of the same product.

---

## Decisions

| Topic | Decision |
|-------|----------|
| Primary use case | Threat assessment review — table is index, drill-in is primary work surface |
| Above-table chrome | Keep STRIDE heatmap (acts as distribution view + filter trigger). Drop the four summary cards (redundant with heatmap). |
| Detail surface | Full-page route `/projects/:projectId/threats/:threatId` (replaces inline sidesheet). Deep-link safe. |
| Filter pattern | Search input + single `Filters ▾` popover (severity / status / STRIDE inside). Active-filter chip row below toolbar. |
| Table density | Comfortable — ~44px rows, description preview below title, ~10 rows visible per screen. |
| Delivery | Big-bang rewrite on a single feature branch, executed via subagent-driven plan. |

---

## 1. Routes

| Route | Page component |
|-------|----------------|
| `/projects/:projectId/threats` | `ThreatsDashboardPage` (rebuilt) |
| `/projects/:projectId/threats/:threatId` | `ThreatDetailPage` (new) |

Both pages follow the secondary-page chrome convention defined in `CLAUDE.md`: `h-9` header, Layers logo, Back button, project context label, right-side actions (theme toggle, user/sign-out).

---

## 2. Component breakdown

| File | Approx. lines | Purpose |
|------|---------------|---------|
| `components/ThreatsDashboardPage.tsx` | ~250 | Orchestrates page state, fetch, URL sync, modal triggers |
| `components/threats/ThreatsTable.tsx` | ~150 | Table + row click → router.push, click-to-edit status pill |
| `components/threats/StrideHeatMap.tsx` | ~120 | Existing heatmap extracted as-is from monolith |
| `components/threats/FiltersPopover.tsx` | ~120 | Severity / Status / STRIDE selectors via `DropdownMenu`, "Clear all" |
| `components/threats/ActiveFilterChips.tsx` | ~60 | Chip row with X-per-filter + "Clear all" |
| `components/threats/AddThreatModal.tsx` | ~150 | Existing modal extracted as-is |
| `components/ThreatDetailPage.tsx` | ~400 | New detail page; absorbs former `ThreatDetailSidesheet` body |
| `app/projects/[projectId]/threats/[threatId]/page.tsx` | ~20 | Server component → client `<ThreatDetailPage />` |
| `lib/threatBadges.ts` | ~50 | Shared label maps (severity/STRIDE/status); replaces inline `SEVERITY_BADGE`, `STATUS_BADGE`, `STRIDE_LABEL` constants |

**Primitives reused** (from `components/ui/`):
- `Button`, `IconButton`, `Tooltip`, `EmptyState`
- `StatusPill` — variants: `severity`, `stride`, `status`, `source`
- `ClickToEditPill` — table status cell, detail page status pill
- `DropdownMenu` — inside `FiltersPopover`, status dropdown, top-bar overflow
- `SeverityStripeRow` — table row leading stripe

**Markdown renderers:** `mitigationMdComponents` block stays inside `ThreatDetailPage.tsx` (sole consumer post-migration).

---

## 3. State + data flow

### Dashboard page

```ts
const [search, setSearch] = useState('');
const [filterSeverity, setFilterSeverity] = useState<ThreatSeverity | 'ALL'>('ALL');
const [filterStatus, setFilterStatus] = useState<ThreatStatus | 'ALL'>('ALL');
const [filterStride, setFilterStride] = useState<StrideCategory | 'ALL'>('ALL');
const [page, setPage] = useState(0);
const [result, setResult] = useState<ThreatsDashboardResult | null>(null);
const [tableLoading, setTableLoading] = useState(false);
```

- **URL sync:** `?search=…&sev=HIGH&status=OPEN&stride=TAMPERING&page=2`. Read on mount via `useSearchParams`; URL writes are immediate via `router.replace` (no debounce). `page` is 1-indexed in the URL for readability; converted to 0-indexed internally. Refresh-safe, deep-link safe.
- **Fetch:** debounced `apiListProjectThreats(projectId, { search, severity, stride, status, page, pageSize: 20 })` 250 ms after any filter or page change. Uses `tableLoading` to dim the table during refetch (no full-page spinner). Verify the existing `apiListProjectThreats` signature in `lib/api.ts` and align (object vs positional) without restating it here.
- **Heatmap ↔ filters:** clicking a heatmap cell sets `filterSeverity` + `filterStride` together. Two chips appear in the active-filter row. Clicking the same active cell again clears both. URL syncs.
- **Status edits:** `ClickToEditPill` in the table cell calls `apiUpdateThreat(threatModelId, threatId, { status })` and patches the local row. No re-fetch.

### Detail page

- **Fetch:** `apiGetThreat(projectId, threatId)` on mount. **(New backend endpoint — see §7.)**
- **Edits:** local edits (status, mitigation text) → `apiUpdateThreat` then patch local state.
- **Delete:** confirm modal → `apiDeleteThreat` → `router.push('/projects/:id/threats')`.

---

## 4. Detail page UX

### Top bar

- Layers logo + "Back to threats" button → `/projects/:id/threats`
- Project name + " — " + threat title (truncated; full on hover via `Tooltip`)
- Right-side cluster: status `ClickToEditPill` · `Delete` button (destructive variant) · theme cycle · user/sign-out

### Body (max-w-4xl, centered, scrollable)

```
┌─────────────────────────────────────────────────────────┐
│ [HIGH] [Tampering] [AI] [Layer · root]                  │  ← StatusPill row
│                                                          │
│ Plaintext credential storage                             │  ← h1
│ Passwords stored as plaintext in users.password column…  │  ← description
│                                                          │
│ ── Target ────────────────────────────────────────────  │
│ user-svc (node)                                          │
│                                                          │
│ ── Mitigation ────────────────────────────────────────  │
│ [textarea — click to edit, Save / Cancel]                │
│                                                          │
│ ── AI Mitigation Advice ──────────────────  [↻]  [Copy] │
│ {markdown via mitigationMdComponents}                    │
│                                                          │
│ ── Metadata ──────────────────────────────────────────  │
│ Source · Identified · Last updated · Threat Model name   │
└─────────────────────────────────────────────────────────┘
```

### Status states

- Status `ACCEPTED` shows an acceptance-warning chip directly below the title.
- Status `FALSE_POSITIVE` does not dim the detail page (only the dashboard row).

### Errors

- 404 → `EmptyState` primitive: "Threat not found · may have been deleted" + "Back to threats" CTA.
- Network error → inline retry banner + last-known-good content (if any).

---

## 5. Filters popover

### Trigger

```
Default state:  [⚙ Filters ▾]
Active state:   [⚙ Filters · 2 ▾]   ← count badge when ≥ 1 filter applied; blue accent
                                      Count = number of non-ALL filter selects
                                      (severity / status / STRIDE). Search is not counted.
```

### Popover (~280px wide, anchored below trigger)

```
Severity   [DropdownMenu — All / Critical / High / Medium / Low / Info]
Status     [DropdownMenu — All / Open / In review / Mitigated / Accepted / FalsePositive]
STRIDE     [DropdownMenu — All / Spoofing / Tampering / Repudiation / Info Disc / DoS / Elev]
─────────────────
[Clear all]                                    [Done]
```

- Each `DropdownMenu` shows the current value as the trigger label (e.g. "Severity: High").
- "Clear all" resets all three to `'ALL'`.
- "Done" closes the popover. Outside-click also closes.
- Selections apply immediately — no Apply button.

### Active-filter chip row (below toolbar; hidden when no filters applied)

```
[Severity: HIGH ✕]  [STRIDE: Tampering ✕]  [Status: Open ✕]   Clear all
```

Each chip uses `StatusPill` for visual consistency with the table cells. Clicking ✕ resets that specific filter to `'ALL'`. URL syncs immediately.

---

## 6. Table

### Columns

| Column | Width | Visible at | Notes |
|--------|-------|-----------|-------|
| Threat | flex | always | Title (font-medium) + description preview (text-xs truncate) |
| Target | 140px | sm+ | Node/edge name; mono font |
| Severity | 100px | always | `StatusPill variant="severity"` |
| STRIDE | 140px | md+ | `StatusPill variant="stride"` |
| Status | 120px | always | `ClickToEditPill variant="status"` |
| Layer | 120px | lg+ | text-xs slate; dim if root layer |
| Source | 64px | xl+ | `StatusPill variant="source"` (AI / User) |

The current "Model" column is removed — it now lives in detail-page metadata.

### Row interaction

- Click row → `router.push('/projects/:id/threats/:threatId')`.
- Click the status cell → opens `ClickToEditPill` dropdown; `stopPropagation` so navigation does not fire.
- Hover → row tint + leading severity stripe via `SeverityStripeRow`.
- `FALSE_POSITIVE` rows render at opacity 50%.

### Empty / error / loading

- **No threats yet** → `EmptyState` with "Run a threat analysis" CTA → links to `/projects/:id`.
- **No matches for filters** → `EmptyState` with "Clear filters" CTA.
- **Loading** → table opacity 60%; spinner in toolbar.
- **Error** → inline alert banner (red) above the table, with retry.

### Pagination

`← Previous` · `1 2 3 …` · `Next →` — neutral slate styling. Active page = blue ring (no red background).

---

## 7. Backend dependency

A new endpoint is required for the detail page to load via direct URL (refresh / deep link):

```
GET /api/projects/:projectId/threats/:threatId
→ 200 ProjectThreat
→ 404 if missing OR if not owned by the authenticated user (see below)
```

Frontend client:

```ts
export function apiGetThreat(projectId: string, threatId: string): Promise<ProjectThreat> {
  return apiFetch(`/api/projects/${projectId}/threats/${threatId}`);
}
```

**Plan ordering:** backend-first. Add the endpoint in `layers-rest` (Task 0), ship that PR, then the frontend rewrite consumes it.

### 7.1 Security — IDOR / BOLA protection

This endpoint takes two attacker-controllable IDs (`projectId`, `threatId`). Both must be authorized end-to-end. Apply the same pattern the existing threat controller uses, with one tightening (return 404 instead of 403 to prevent enumeration).

**Required controls:**

1. **Auth gate** — `@UseGuards(JwtAuthGuard)` on the controller. Reject unauthenticated requests with 401 before any handler runs.
2. **UUID validation** — `@Param('projectId', ParseUUIDPipe)` and `@Param('threatId', ParseUUIDPipe)` reject malformed input with 400 before DB hits.
3. **Tenant scoping at the query level** — fetch the threat with a Prisma `where` clause that joins through `threatModel.project.ownerId === userId` AND `threatModel.projectId === projectId`. Do NOT fetch by `threatId` alone and check ownership in TS — the query itself must enforce it. Example:
   ```ts
   const threat = await prisma.threat.findFirst({
     where: {
       id: threatId,
       threatModel: {
         projectId,
         project: { ownerId: userId },
       },
     },
     include: { threatModel: { include: { project: { select: { id: true, name: true } } } } },
   });
   if (!threat) throw new NotFoundException('Threat not found');
   ```
4. **Uniform 404** — return `NotFoundException` for: threat does not exist, threat belongs to a different project, threat belongs to a project the user does not own. Do NOT return 403 in any of these cases — a 403 confirms the ID is real and belongs to someone else, enabling enumeration.
5. **No `findUnique` followed by ownership check** — that pattern exists elsewhere in the codebase (e.g. `updateThreat`, `deleteThreat`) and leaks existence. The new endpoint must use the joined-where pattern above; the older endpoints can be hardened separately and are out of scope here.
6. **Logging** — log `userId`, `projectId`, `threatId`, and request outcome at info level. Do NOT include threat content (title, description, mitigation) in logs.
7. **Rate limiting** — if the existing controller uses `@Throttle()`, apply the same throttle. Otherwise no new throttle is required for this task.

**Test cases (manual or automated, depending on layers-rest test infra):**

- A: User owns project P1 with threat T1 → `GET /projects/P1/threats/T1` → 200.
- B: User owns project P1 with threat T1; another user owns P2 with threat T2 → user requests `GET /projects/P1/threats/T2` → 404 (not 403). Confirms cross-project IDOR is closed.
- C: User does not own any project; requests `GET /projects/P1/threats/T1` → 404. Confirms cross-tenant BOLA is closed.
- D: Unauthenticated request → 401.
- E: Malformed `projectId` or `threatId` (non-UUID) → 400.
- F: `threatId` exists but is on a different project than the URL's `projectId` → 404 (not 200, not 403).

---

## 8. Out of scope

Deliberately deferred — not in this design:

- Bulk actions (multi-select rows, bulk status change)
- CSV export of the dashboard view (PDF report stays as-is)
- Saved filter presets
- Activity log per threat
- Comments / collaboration on threats
- Real-time updates via websocket
- Refactor of `mitigationMdComponents` markdown renderers
- Tests — no test infrastructure in this repo today; manual verification only

---

## 9. Quality gates (per implementation task)

- `npx tsc --noEmit` → 0 errors
- `npm run build` → "Compiled successfully"
- **Do not** run `npm run lint` — pre-existing broken in Next 16 at the repo level.
- Manual: every visible surface verified in both light and dark mode (`html.dark` toggle).
