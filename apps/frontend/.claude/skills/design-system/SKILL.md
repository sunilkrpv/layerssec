---
name: design-system
description: >
  Layers UI consistency — the components/ui primitives, AppShell/navigation, the secondary-page
  top-bar pattern, theme/dark-mode, badge conventions, and panel docking. Invoke when building or
  restyling any UI surface so it matches the rest of the app.
---

# Layers — Design System

You own visual + interaction consistency across the Layers frontend. Engineering technique lives in
`frontend-engineer`; this skill owns *what things should look like and which primitive to reuse*.

Tailwind CSS v3, dark mode via the `class` strategy. Reuse primitives before writing new markup.

---

## UI Primitives (`components/ui/`, re-exported from `index.ts`)

| Primitive | Use for |
|-----------|---------|
| `Button` | Standard buttons (variants/sizes) |
| `IconButton` | Icon-only actions (toolbar, headers) |
| `DropdownMenu` | Menus, action overflow, pickers |
| `StatusPill` | Status chips (threat status, job status) |
| `ClickToEditPill` | Inline-editable label pill |
| `SeverityStripeRow` | Row with a severity color stripe (threat lists) |
| `PostureBar` | Posture score bar/visual |
| `SearchGridPalette` | Searchable grid picker (e.g. node palette) |
| `EmptyState` | Zero-data states |
| `Tooltip` | Hover tooltips |
| `useDensity` | Hook for compact/comfortable density |

**`app/dev/primitives`** (`layout.tsx` + `page.tsx`) is the live gallery — the canonical reference
for how each primitive looks and behaves. Add new primitives to the gallery.

---

## App Shell & Navigation

- `AppShell` — top-level authenticated layout: `h-screen` flex column, header + `HomeSidebar` + `<main>`; redirects to `/login` when not logged in; dark-aware (`bg-slate-50 dark:bg-slate-950`).
- `HomeSidebar` — primary nav between the top-level sections.
- Route map: `home`, `activity`, `intel`, `trust-map`, `projects/[projectId]` (+ `/threats[/threatId]`, `/ai-history`), `diff`, `dev/primitives`, `login`.

---

## Secondary-Page Top-Bar Pattern

All secondary pages (AI History, Threats Dashboard, Security Intel, Trust Map, etc.) **must** use this
exact top bar — do NOT use a sticky `div` with `max-w-7xl`:

```tsx
<div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-gray-950">
  <header className="flex h-9 flex-shrink-0 items-center border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
    {/* Logo */}
    <div className="mr-4 flex items-center gap-1.5 pl-1">
      <Layers size={14} className="text-blue-600" />
      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Layers</span>
    </div>
    {/* Back button */}
    <button onClick={() => router.push(`/projects/${projectId}`)} className="flex items-center gap-1.5 rounded px-3 py-1 text-sm text-slate-700 hover:bg-slate-200 ...">
      <ArrowLeft size={13} /> Back to diagram
    </button>
    <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
    {/* Page context: icon + name */}
    <div className="flex items-center gap-1.5">
      <PageIcon size={12} className="text-accent-500" />
      <span className="text-sm text-slate-600 dark:text-slate-300">{projectName} — Page Title</span>
    </div>
    {/* Right: action buttons | theme toggle | separator | user email + LogOut */}
    <div className="ml-auto flex items-center gap-1"> ... </div>
  </header>
  {/* Scrollable content */}
  <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
    <div className="mx-auto max-w-7xl px-6 py-6"> ... </div>
  </div>
</div>
```

Key rules: `h-9` header, `bg-slate-50 dark:bg-slate-900` header bg, `h-4 w-px` separators, theme cycle
button, user email + LogOut on the right.

---

## Theme / Dark Mode

- `lib/themeStore.ts` — `Theme = 'light' | 'dark' | 'system'`, `THEME_KEY = 'layers_theme'`.
- `lib/themeContext.ts` — `useTheme()`; `components/ThemeProvider.tsx` adds/removes the `dark` class on `<html>`.
- **FOUC prevention**: inline `<script>` in `app/layout.tsx` runs before React hydrates.
- MenuBar/header cycles light → dark → system (Sun/Moon/Monitor icons).
- Components use `dark:` variants (e.g. `dark:bg-slate-800 dark:text-slate-100`).

---

## Badge Conventions

- `lib/threatBadges.ts` — `SEVERITY_OPTIONS` (CRITICAL/HIGH/MEDIUM/LOW/INFO), `STATUS_OPTIONS` (IDENTIFIED/IN_PROGRESS/MITIGATED/ACCEPTED/FALSE_POSITIVE), `STRIDE_OPTIONS`, plus `STRIDE_LABEL`, `STRIDE_FULL_LABEL`, `STATUS_LABEL`, `SEV_SHORT`, `SEVERITY_COLOR_RGB`, `formatThreatDate`. Always source severity/STRIDE/status colors + labels here — never hardcode.
- `lib/projectBadges.ts` — `PROJECT_COLORS`, `projectColor(id)`, `formatRelativeDate(iso)`.

Note: threat status values are `IDENTIFIED` / `IN_PROGRESS` / `MITIGATED` / `ACCEPTED` / `FALSE_POSITIVE` (not `OPEN`).

---

## Panel Docking

Security/AI tools dock as right-side full-height panels with ⌘ toggles, over the canvas:
- `AIChatPanel` (Cmd+I), `ThreatModelPanel` (⌘⇧M), `PostureScorePanel`, `AttackMindPanel`.
- Panels coexist with React Flow overlays (`ThreatOverlay`, `AttackPathOverlay`, `DeclutterOverlay`) — see `frontend-engineer`.

## Cross-links
- **`frontend-engineer`** — component/state technique, overlays, streaming + job-polling.
