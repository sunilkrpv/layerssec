# Drafter — Project Intelligence

## Overview
Drafter is a web-based layered diagramming tool built with **Next.js 14 App Router**, **React Flow 11**, and **Anthropic Claude** (AI diagram generation). Users build architecture diagrams, drill into nodes to create sub-layers, and export as PNG or JSON.

## Stack
- **Framework**: Next.js 14 App Router (`app/` directory, `'use client'` components)
- **Canvas**: React Flow 11 (`reactflow`) — nodes, edges, handles, NodeResizer
- **AI**: Anthropic Claude API — streaming via `app/api/generate/route.ts` and `app/api/evaluate/route.ts`
- **Styling**: Tailwind CSS v3 (`darkMode: 'class'`)
- **Storage**: `localStorage` via `lib/layerStore.ts` (no database); cloud via drafter-rest backend
- **Icons**: `lucide-react`

---

## Key Architecture Patterns

### Layer System
- `lib/layerStore.ts` — `LayerMap = Record<string, Layer>`, persisted in `localStorage`
- Each `Layer`: `{ id, name, description, parentLayerId, parentNodeId, nodes, edges, createdAt }`
- `app/page.tsx` uses `key={currentLayerId}` on `<DiagramCanvas>` to force React remount on layer switch
- Navigation: `navStack: string[]` — last item is current layer
- `deleteLayerCascade` removes layer + all descendants + clears `_childLayerId` badges
- `getOrphanedLayers` returns layers with `parentNodeId === null` (standalone layers)

### CanvasContext (`lib/canvasContext.ts`)
Provides to all node components without prop-drilling:
- `navigateTo(layerId)` — drill-down navigation
- `updateNodeData(nodeId, data)` — live node data updates
- `editingNodeId`, `editInitialChar`, `startEditing`, `stopEditing` — inline label editing state
- `pushHistoryNow()` — snapshot undo state before drag gestures

### ExtendedRFInstance (`components/DiagramCanvas.tsx`)
Extends `ReactFlowInstance` with custom methods on `rfInstanceRef`:
- `loadDiagram`, `clearDiagram`, `updateNodeData`, `deleteNode`, `addNodeAtCenter`
- `bringToFront`, `sendToBack` — adjust `zIndex` relative to current min/max
- `groupNodes(nodeIds)` — calc bounding box, create GroupNode, set `parentNode`+`extent:'parent'` on children
- `ungroupNode(groupId)` — restore absolute positions, remove `parentNode`/`extent`
- `updateEdge(edgeId, updates)`, `deleteEdge(edgeId)`, `pushHistoryNow()`

### Node Color System
Each `NodeData` carries optional `borderColor`, `fillColor`, `textColor` (CSS color strings) and `rotation?: number`.
Nodes apply via **inline styles** overriding Tailwind:
```tsx
style={{ borderColor: data.borderColor || undefined, backgroundColor: data.fillColor || undefined,
         transform: `rotate(${data.rotation ?? 0}deg)`, transformOrigin: 'center', overflow: 'visible' }}
```

### Theme System
- `lib/themeStore.ts` — `Theme = 'light' | 'dark' | 'system'`, `THEME_KEY = 'drafter_theme'`
- `lib/themeContext.ts` — `useTheme()` hook; `components/ThemeProvider.tsx` applies/removes `dark` class on `<html>`
- FOUC prevention: inline `<script>` in `app/layout.tsx` runs before React hydrates
- MenuBar right side cycles light → dark → system (Sun/Moon/Monitor icons)
- Components use `dark:` Tailwind variants (e.g. `dark:bg-slate-800 dark:text-slate-100`)

### Cloud Persistence
- Backend: drafter-rest (NestJS); base URL from `NEXT_PUBLIC_API_URL`
- `lib/api.ts` — `apiFetch` with `Authorization: Bearer` header; dispatches `drafter:unauthorized` on 401
- `lib/authStore.ts` — `saveTokens/clearTokens/getAccessToken/getStoredUser`
- Each Drafter project = one NestJS `Project` + one NestJS `Diagram` (`canvasData` = `ProjectFile`)
- Versioning: diagrams have `status` (draft/published); endpoints: `publish`, `checkout`, `listVersions`, `getDraft`
- **Checkout rule**: "Check Out" button only shown for the **latest** published version AND only when no draft exists. Both frontend (`ProjectsListPage`) and backend (`DiagramsService.checkout`) enforce this — backend throws 400 for non-latest version, 409 for existing draft.
- DiagramPage: debounced `apiUpdateDiagram` 2s after last change; blocked when `isReadOnly`

### Important Implementation Patterns
- **Pure setLayers updaters**: Never put side-effects inside `setLayers` callback (React 18 Strict Mode double-invokes). All setState calls go OUTSIDE the updater.
- **Stale closure pattern**: Use refs (`saveEnabledRef`, `autoSaveRef`, `backendDiagramIdRef`, `buildProjectSnapshotRef`) for values needed inside timers/intervals.
- **Cloud save pattern**: After mutation → `setTimeout(() => buildProjectSnapshotRef.current() → apiUpdateDiagram, 200)` to let React state settle.
- **Bulk node file edits**: Use a Python script via Task agent to avoid the Write-tool "file not read" limitation.

---

## Features

### Canvas & Nodes
- 21 node types: 12 cloud service nodes + 9 shape nodes (rectangle, circle, ellipse, line, arrowline, dottedline, actor, cylinder, triangle)
- Node colors: `borderColor`, `fillColor` (incl. transparent `∅`), `textColor`; 9-swatch picker in PropertiesPanel
- Node rotation: drag `RotateHandle` to rotate; snaps to 5°; undo-aware (`pushHistoryNow` at drag start)
- Inline label editing: type-to-edit when single node selected; `EditableLabel` + CanvasContext
- Copy/Paste: Ctrl+C/V with ID remapping, +30px offset; clipboard lifted to DiagramPage (survives `key=` remounts)
- Undo/Redo: Cmd+Z / Cmd+Shift+Z; history stacks (refs, capped at 50) in DiagramCanvas
- Z-order: Bring to Front / Send to Back via right-click
- Grouping: select 2+ nodes → Group (React Flow parent-child containment); Ungroup restores absolute positions
- NodeResizer on all non-line nodes

### Line Nodes
- Line/arrowline/dottedline support rotation via `RotateHandle`
- `LineEndpointHandle`: small blue dots at endpoints when selected; drag to snap/attach to nearby nodes
- Live attachment sync: when attached node moves, line position/width update in real-time (`attachedSource`/`attachedTarget` in NodeData)
- Snap-to-shape on drop: endpoints snap to nearest shape boundary within 40px

### Layer Navigation
- Drill-down: right-click node → create/navigate child layer; `_childLayerId` links node to its layer
- Layer bar breadcrumbs, rebuilt from URL on deep-link load
- Layers manager modal: inline name/description edit, navigate button
- `ChildLayerBadge` on nodes with drill-down layers
- Assign/Reassign layer: right-click shape → assign orphaned or sibling-owned layer; 2-step confirm; `AssignableLayer` type

### AI Features
- **Generation**: streaming Claude → nodes/edges via `/api/generate`
- **Evaluation**: streaming architecture analysis via `/api/evaluate`; Q&A mode via `userQuestion` param
- **AIChatPanel**: docked full-height sidebar (Cmd+I toggle); dark navy/indigo brand colors; `ThinkingDots`; `react-markdown` + `remark-gfm`; `isReadOnly` mode for Q&A only
- **AI History Page** (`/projects/:id/ai-history`):
  - Layers sidebar tree with Eye (preview popup) and Paperclip (attach context) per layer
  - `DiagramBubble`: Preview/Hide toggle (inline React Flow) + Maximize + "Apply →"
  - `ApplyDiagramModal` 2-step: (1) override attached layer OR create new, (2) optionally link to node
  - `splitDiagramContent`: splits on `---DIAGRAM---`, falls back to last ` ```json ``` ` block
  - Streaming: diagram JSON stripped from visible markdown live; `beforeunload` blocked while streaming
- **`MiniDiagramPreview`**: shared read-only React Flow canvas (layer previews + chat bubbles)
- **Contextual chat (RAG)**: AI History Page uses `apiContextualChatAsk` → `POST /api/ai/chat/contextual-ask`; backend gathers diagram info, nodes, versions + ChromaDB semantic memories before responding; `diagramId` (draft) passed from page state

### File & Project Management
- File System Access API: open/save/save-as project JSON; fallback browser download
- Auto-save: 60s interval (local file) + 2s debounced backend save
- URL sync: `/projects/:projectId?currLayer=:layerId`; navStack rebuilt from URL via `getLayerPath`
- Project versioning: Publish (with comment) → read-only view; Check Out → new draft; version history list
- Project diff: `/diff` route; `diffProjects(left, right): ProjectDiff`; split-view two canvases; color-coded by `DiffStatus`

### UX
- Toolbar: Save, Auto Save toggle, Zoom in/out/fit, last-saved indicator, Delete, Animate toggle; hides edit controls in `isReadOnly`
- MenuBar: File/View/AI/About dropdowns; project name display; theme toggle; My Projects / Sign in/out
- PropertiesPanel: colors, rotation controls, node data
- EdgePropertiesPanel: label, arrow direction (→/←/↔/—), stroke color
- Alignment guides: red dotted lines during drag when centers/edges align within 5px
- Read-only published mode: dark indigo banner with "Check Out to Edit" CTA; `isReadOnly` hides all edit controls
- Startup modal: Open project / New project / Continue / My Cloud Projects

---

## Key File Map
| File | Purpose |
|------|---------|
| `app/page.tsx` | Redirects to `/projects/local` |
| `app/projects/[projectId]/page.tsx` | Server Component route → `DiagramPage` |
| `components/DiagramPage.tsx` | Main client component — all state, handlers, URL sync, context wiring |
| `components/DiagramCanvas.tsx` | React Flow wrapper, copy/paste, undo/redo, ExtendedRFInstance |
| `lib/types.ts` | `NodeType`, `NodeData`, `DiagramEdge`, `GenerateResponse` |
| `lib/layerStore.ts` | Layer CRUD + localStorage persistence |
| `lib/canvasContext.ts` | React context shared with all node components |
| `lib/nodeConfig.ts` | `PALETTE_ITEMS`, `LINE_NODE_TYPES` |
| `lib/diagramUtils.ts` | `generateId`, `toReactFlowNodes/Edges`, `EDGE_MARKER`, `EDGE_MARKER_START` |
| `lib/api.ts` | Typed API client for drafter-rest (auth, projects, diagrams, versioning) |
| `lib/authStore.ts` | localStorage token/user management |
| `lib/themeStore.ts` / `lib/themeContext.ts` | Theme persistence and `useTheme()` hook |
| `lib/fileStore.ts` | File System Access API utilities |
| `lib/diffEngine.ts` | `diffProjects(left, right): ProjectDiff` |
| `components/ThemeProvider.tsx` | Applies/removes `dark` class on `<html>` |
| `components/MenuBar.tsx` | App-style menu bar — File/View/AI/About dropdowns |
| `components/Toolbar.tsx` | Zoom controls, Save, Auto Save toggle, clear |
| `components/NodePalette.tsx` | Left sidebar, collapsible, click/drag to add |
| `components/PropertiesPanel.tsx` | Selected node: colors, rotation, data |
| `components/EdgePropertiesPanel.tsx` | Selected edge: label, arrow direction, color |
| `components/LayersPanel.tsx` | Modal OR docked right sidebar (`docked` prop) |
| `components/LayerBar.tsx` | Breadcrumb navigation bar |
| `components/AIChatPanel.tsx` | Docked AI chat sidebar; markdown; streaming; read-only Q&A mode |
| `components/AIHistoryPage.tsx` | Full-page AI chat history; DiagramBubble; ApplyDiagramModal |
| `components/MiniDiagramPreview.tsx` | Shared read-only React Flow canvas |
| `components/AuthModal.tsx` | Login / Register modal |
| `components/ProjectsModal.tsx` | Cloud project browser |
| `components/ProjectsListPage.tsx` | Projects table + version history side-sheet |
| `components/PublishModal.tsx` | Publish with optional comment; shows version number |
| `components/StartupModal.tsx` | Fresh-load modal: Open / New / Continue / Cloud |
| `components/FileLoadPrompt.tsx` | Modal when URL layer not found locally |
| `components/DiffPage.tsx` | Split-view diff UI at `/diff` |
| `components/DiffCanvas.tsx` | Read-only React Flow canvas with diff status overlays |
| `components/DiffLayersPanel.tsx` | Layer list with diff badges and change counts |
| `components/AssignLayerModal.tsx` | Assign orphaned/sibling layer to node (2-step confirm) |
| `components/nodes/EditableLabel.tsx` | Inline label editor (context-driven) |
| `components/nodes/ChildLayerBadge.tsx` | Badge on nodes with child layers |
| `components/nodes/RotateHandle.tsx` | Drag-to-rotate handle |
| `components/nodes/LineEndpointHandle.tsx` | Draggable endpoint dots for line nodes |
| `components/nodes/*.tsx` | 21 node types (12 cloud + 9 shape) |
| `app/api/generate/route.ts` | Streaming Claude diagram generation |
| `app/api/evaluate/route.ts` | Streaming Claude diagram evaluation |
| `app/api/ai/chat/ask/route.ts` | Streaming Claude chat for AI History page |
| `lib/api.ts → apiContextualChatAsk` | RAG-enhanced streaming chat; passes `projectId` + `diagramId` to backend |
| `app/diff/page.tsx` | Server Component route → `<DiffPage />` |

## Verification Commands
```bash
npx tsc --noEmit   # must be 0 errors
npm run build      # must complete successfully
```
