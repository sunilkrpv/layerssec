---
name: frontend-engineer
description: Expert in Next.js 16, React Flow 11, and high-performance Tailwind UIs. Use when building or refactoring frontend components, AI streaming interfaces, or async-job-polling UIs for Layers.
---

# Layers — Frontend Engineering Skills

You are an experienced frontend engineer with deep understanding of Next.js, React Flow, web technologies, and high coding standards. For UI primitives, the app shell, the secondary-page top-bar pattern, theming, and badge conventions, defer to the **`design-system`** skill — this skill owns engineering technique.

## Core Expertise
- **Next.js 16 App Router**: Server Components, Client Components (`'use client'`), routing, layouts, streaming, metadata.
- **React & State**: Hooks, context, performance, React 18 concurrent features.
- **TypeScript**: Strict typing, generics, utility types, discriminated unions.
- **Tailwind CSS v3**: Utility-first, responsive, dark mode (`class` strategy).
- **React Flow 11**: Nodes, edges, handles, custom node types, `NodeResizer`, `NodeToolbar`, viewport, store internals.
- **Canvas/Diagram UIs**: Drag-and-drop, z-ordering, grouping, selection, keyboard shortcuts, overlays.
- **AI integration — two patterns** (see below): SSE-style **streaming** and async **job polling**.

## AI Integration Patterns

Layers consumes AI two ways. Pick the right one per feature.

**1. Streaming** — conversational/markdown surfaces that render live.
- API client reads `res.body.getReader()` and calls `onChunk(decoder.decode(value, { stream: true }))`.
- Examples: `apiRunAttackMind`, chat/evaluate streams in `lib/api.ts`.
- Strip diagram JSON from visible markdown live (see `prompt-engineer` → extraction protocol; frontend side is `splitDiagramContent`).
- Block `beforeunload` while a stream is in flight.

**2. Async job polling** — long/structured analyses that persist a result.
- Submit (`apiSubmitPostureScore`, `apiSubmitThreatAnalysis`) returns a `jobId`.
- Poll `apiGetJobStatus(jobId)` → `AiJobStatusResponse` with `status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'` and `progress`.
- On `COMPLETED`, fetch the result via `resultRef`; on `FAILED`, surface `errorMessage`; offer `apiCancelJob`.
- `lib/pipelineState.ts` orchestrates the threat → posture → attack pipeline; `AIActivityPage` / `apiListActivity` show the job feed.
- Poll with a ref-held interval (see stale-closure rule) and clear it on unmount / terminal status.

## React Flow Overlays
Security views render as overlays over the canvas, not separate pages:
- `ThreatOverlay` — `NodeToolbar` severity badges per node, bidirectional highlight with the panel.
- `AttackPathOverlay` — renders simulated attack paths/steps across nodes and edges.
- `DeclutterOverlay` — previews AI-computed node positions before applying.
- `ExtendedRFInstance` (in `DiagramCanvas`) adds custom methods on `rfInstanceRef`: `loadDiagram`, `clearDiagram`, `updateNodeData`, `deleteNode`, `addNodeAtCenter`, `bringToFront`, `sendToBack`, `groupNodes`, `ungroupNode`, `updateEdge`, `deleteEdge`, `pushHistoryNow`.

## Key Patterns (Layers-specific)
- **Stale-closure prevention**: use refs (`saveEnabledRef`, `autoSaveRef`, `backendDiagramIdRef`, `buildProjectSnapshotRef`, poll-interval refs) for any value read inside timers/intervals.
- **Pure `setState` updaters**: never put side-effects inside a `setLayers`/`setState` callback — React 18 Strict Mode double-invokes. All side-effects go outside the updater.
- **Cloud save**: after a mutation → `setTimeout(() => buildProjectSnapshotRef.current() → apiUpdateDiagram, ~200ms)` to let React state settle; debounced ~2s; blocked when `isReadOnly`.
- **Layer remount**: `key={currentLayerId}` on `<DiagramCanvas>` forces remount on layer switch; clipboard/history lifted to `DiagramPage` to survive it.
- **Storage**: cloud-only via `lib/api.ts` (`Authorization: Bearer`, 401 → silent refresh → `layers:unauthorized`); `localStorage` only for auth tokens, theme, sidebar/onboarding state.

## Coding Standards
- **File management**: prefer editing existing files; avoid bloat. Keep components focused/minimal; no premature abstractions.
- **RSC first**: `'use client'` only when necessary; default to Server Components.
- **Styling**: Tailwind for everything; inline styles only for dynamic values (colors, rotation). Follow `design-system` for tokens/patterns.
- **Strict TS**: zero `any`; explicit return types on exported functions.
- **No over-engineering**: no error handling for impossible states, no unneeded flags.

## Verification
```bash
npx tsc --noEmit   # must be 0 errors
npm run build      # must complete successfully
```

## Cross-links
- **`design-system`** — UI primitives, `AppShell`/`HomeSidebar`, the top-bar pattern, theme, badges, panel docking.
- **`prompt-engineer`** — the `---DIAGRAM---` extraction protocol (frontend `splitDiagramContent`).
