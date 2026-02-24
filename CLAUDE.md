# Drafter — Project Intelligence

## Overview
Drafter is a web-based layered diagramming tool built with **Next.js 14 App Router**, **React Flow 11**, and **Anthropic Claude** (for AI diagram generation). Users can build architecture diagrams, drill down into nodes to create sub-layers, and export diagrams as PNG or JSON.

## Stack
- **Framework**: Next.js 14 App Router (`app/` directory, `'use client'` components)
- **Canvas**: React Flow 11 (`reactflow`) — nodes, edges, handles, NodeResizer
- **AI**: Anthropic Claude API — streaming generation via `app/api/generate/route.ts`
- **Styling**: Tailwind CSS v3
- **Storage**: `localStorage` via `lib/layerStore.ts` (no database)
- **Icons**: `lucide-react`

## Key Architecture Patterns

### Layer System
- `lib/layerStore.ts` — `LayerMap = Record<string, Layer>`, persisted in `localStorage`
- Each `Layer` has `{ id, name, description, parentLayerId, parentNodeId, nodes, edges, createdAt }`
- `app/page.tsx` uses `key={currentLayerId}` on `<DiagramCanvas>` to force React remount on layer switch, re-initialising React Flow state cleanly
- Navigation stack `navStack: string[]` — last item is current layer

### CanvasContext (`lib/canvasContext.ts`)
Provides to all node components without prop-drilling:
- `navigateTo(layerId)` — drill-down navigation
- `updateNodeData(nodeId, data)` — live node data updates
- `editingNodeId`, `editInitialChar`, `startEditing`, `stopEditing` — inline label editing state
- `pushHistoryNow()` — allows node components (e.g. `RotateHandle`) to snapshot undo state before a drag gesture

### ExtendedRFInstance (`components/DiagramCanvas.tsx`)
Extends `ReactFlowInstance` with custom methods stored on `rfInstanceRef`:
- `loadDiagram`, `clearDiagram`, `updateNodeData`, `deleteNode`, `addNodeAtCenter`
- `bringToFront`, `sendToBack` — adjust `zIndex` relative to current min/max
- `groupNodes(nodeIds)` — calc bounding box, create GroupNode, set `parentNode`+`extent:'parent'` on children
- `ungroupNode(groupId)` — restore absolute positions, remove `parentNode`/`extent`
- `updateEdge(edgeId, updates)` — partial edge update
- `deleteEdge(edgeId)` — remove edge by ID
- `pushHistoryNow()` — exposes `pushHistory` for external callers (e.g. RotateHandle via CanvasContext)

### Node Color System (`lib/types.ts` → node files)
Each `NodeData` carries optional `borderColor`, `fillColor`, `textColor` (CSS color strings) and `rotation?: number`.
Nodes apply these via **inline styles** that override Tailwind defaults:
```tsx
style={{ borderColor: data.borderColor || undefined, backgroundColor: data.fillColor || undefined,
         transform: `rotate(${data.rotation ?? 0}deg)`, transformOrigin: 'center', overflow: 'visible' }}
```
`EditableLabel` accepts a `style` prop for text color.

### Bulk Node Updates
When all 21 node files need the same structural change, use a **Python script via Task agent** to avoid the Write-tool "file not read" limitation.

---

## PR Log

### PR-1 — Foundation
- Next.js + React Flow setup, AI generation endpoint
- Streaming Claude response, basic node types (12 cloud nodes)
- localStorage persistence, PNG export, JSON import/export
- Layered canvas with drill-down, breadcrumb navigation
- `NodeResizer` on all nodes, arrows on edges

### PR-2 — Canvas UX (5 features)
- **Click-to-add**: palette items clickable → `addNodeAtCenter` places at canvas center
- **Copy/Paste**: Ctrl+C/V in `DiagramCanvas.tsx` via `clipboardRef`, ID remapping, +30px offset
- **Inline label editing**: `EditableLabel` component + `CanvasContext` for global edit state; type-to-edit when single node selected
- **Collapsible palette**: `NodePalette.tsx` — section collapse + full panel toggle
- **9 new shape nodes**: rectangle, circle, ellipse, line, arrowline, dottedline, actor, cylinder, triangle
- **Grouped palette**: Cloud Services + Shapes sections
- **Project export/import**: full `LayerMap` serialisation
- **Child layer badges**: `ChildLayerBadge` on nodes with drill-down layers
- **Line nodes**: no drill-down option in context menu

### PR-3 — Colors & Layers Manager
- **Node colors**: border, fill, text color pickers (9 swatches) in Properties panel
- **Color persistence**: `borderColor`, `fillColor`, `textColor` stored in `NodeData`
- **Layers manager**: modal listing all layers with inline name/description editing, navigate button
- **Layer descriptions**: `description?: string` added to `Layer` interface

### PR-5 — Undo/Redo, Line Snap, Alignment Guides, Collapsed Palette Submenu
- **Undo/Redo**: Cmd+Z / Cmd+Shift+Z — history stacks (refs, capped at 50) in DiagramCanvas; wired into all node/edge mutations
- **Line snap-to-shape**: On drag release, line/arrowline/dottedline endpoints snap to the nearest shape boundary within 40px
- **Alignment guides**: Red dotted lines appear during drag when node center/edge aligns within 5px of another node; cleared on release. Rendered as absolute divs using `useViewport()` transform
- **Collapsed palette submenu**: Collapsed mode shows Cloud/Shapes group icons; click to open floating submenu with full item list

### PR-7 — Line Node Rotation + Endpoint Attachment
- **Line rotation**: Line/arrowline/dottedline now support rotation via `RotateHandle` (same as other nodes)
- **Draggable endpoint handles**: When a line node is selected, small blue dots appear at the left and right endpoints (`LineEndpointHandle` component). Drag either dot to a nearby node — the endpoint snaps to that node's edge and records the attachment
- **Live attachment sync**: When an attached non-line node is dragged, the line's position and width update in real-time so the connection is maintained. Both single-end and dual-end attachments are supported
- **Snap-on-drop attachment**: Existing whole-line snap-to-shape (PR-5) now also records `attachedSource`/`attachedTarget` in `NodeData`; dragging the whole line clears the old attachment and sets new one if it snaps
- **`attachedSource/Target`** added to `NodeData` — IDs of nodes each line endpoint is attached to; cleared when line is dragged manually to a new position
- **`LineEndpointHandle`** (`components/nodes/LineEndpointHandle.tsx`): uses `useNodeId`, `useReactFlow`, `useStore`; updates `position` and `style.width` directly via `setNodes` during mousemove
- **`computeUpdatedLinePosition`** module-level helper in `DiagramCanvas.tsx`: recalculates line `position.x/y` and `style.width` to maintain both-end attachments when a connected node moves

### PR-6 — Node Rotation
- **Drag-to-rotate**: All non-line nodes show a rotate handle (circle with RotateCw icon) above the node when selected; drag it to rotate the node around its center
- **Snap to 5°**: Rotation snaps to 5° increments during drag
- **Rotation undo**: `pushHistoryNow()` called once at drag start (not on every mousemove) — one undo step per rotation gesture
- **Properties panel**: Rotation section shows current angle (deg), "Rotate by" input + "Apply CW" button (or Enter), and "Reset rotation" button
- **`rotation?: number` in NodeData**: CSS `transform: rotate(Xdeg)` + `transformOrigin: 'center'` + `overflow: 'visible'` on the outermost node div
- **`RotateHandle` component** (`components/nodes/RotateHandle.tsx`): uses `useNodeId`, `useReactFlow`, `useStore` (nodeInternals + viewport transform) to compute center in screen coords and derive angle from cursor
- **`pushHistoryNow`**: Added to `ExtendedRFInstance`, `CanvasContext` (as `pushHistoryNow: () => void`), and `canvasContextValue` in `app/page.tsx`

### PR-11 — Visual Project Diff
- **`lib/diffEngine.ts`** (new): Pure diff computation between two `LayerMap` objects
  - `DiffStatus`: `'added' | 'removed' | 'modified' | 'unchanged'`
  - `diffProjects(leftLayers, rightLayers): ProjectDiff` — compares every layer and every node/edge by ID; nodes compared by type, position, data, style; edges by source/target/label/markers; layers sorted root-first
  - Layer-level status derived from node/edge change counts + name change
  - `counts` at both layer and project level: `{ added, removed, modified, total }`
- **`components/DiffCanvas.tsx`** (new): Read-only React Flow canvas for diff view
  - Single `diffNode` custom type (module-level to avoid re-registration)
  - Renders node icon + label from `PALETTE_ITEMS` lookup; diff status shown as colored ring + badge (+ green / − red / ~ amber)
  - `side='left'` renders base-project nodes; `side='right'` renders modified-project nodes
  - `nodesDraggable=false`, `nodesConnectable=false`, `elementsSelectable=false`; `fitView` on load
- **`components/DiffLayersPanel.tsx`** (new): Left panel listing all layers across both projects
  - Color-coded rows by diff status; shows `+N −N ~N` change counts per layer
  - Summary badges at top; legend at bottom; click row to switch active layer in both canvases
- **`components/DiffPage.tsx`** (new): Split-view diff page at `/diff`
  - File upload phase: two DropZones (drag-and-drop or click to browse) for base + modified `.json` files
  - Once both loaded: `diffProjects` runs, active layer state drives both canvases in sync
  - Top bar with back link and project-level summary counts
- **`app/diff/page.tsx`** (new): Server Component route at `/diff` → renders `<DiffPage />`
- **`components/MenuBar.tsx`** — added `onOpenDiff` prop + "Diff…" item at bottom of File menu (after a separator)
- **`components/DiagramPage.tsx`** — added `useRouter`, passes `onOpenDiff={() => router.push('/diff')}` to MenuBar

### PR-10 — File-Based Storage + Auto-Save
- **`lib/fileStore.ts`** (new): File System Access API utilities (Chrome/Edge 86+)
  - `canUseFileSystemAPI()` — feature detection
  - `pickAndReadFile()` — opens file picker, reads + parses project JSON; normalises bare `LayerMap` or `{ layers, navStack }`
  - `writeToHandle(handle, data)` — writes project data to existing `FileSystemFileHandle`
  - `pickSaveAndWrite(data)` — opens Save-As picker and writes; returns handle
  - `downloadProjectFile(data)` — fallback browser download for non-supported browsers
- **`components/FileLoadPrompt.tsx`** (new): Modal shown when URL references a layer not in localStorage
  - Prompts user to open project file; shows info warning for Safari/browsers without File API
  - On success: reads file, validates layer exists, navigates + populates breadcrumbs
  - On wrong file: shows error "Layer not found — you may have opened the wrong project"
- **`components/DiagramPage.tsx`** — new file management:
  - `fileHandle` state, `autoSave` state (default ON), `lastSaved` date state
  - Refs (`layersRef`, `navStackRef`, `fileHandleRef`) prevent stale closures in `setInterval`
  - `handleOpenFile` — opens picker, loads layers + navStack
  - `handleSaveFile` — writes to handle; falls back to Save-As or browser download
  - `handleOpenFileForURL(targetLayerId)` — URL-sharing flow: open file → validate → navigate
  - `buildProjectSnapshot()` — flushes canvas then builds `{ layers, navStack }` payload
  - Auto-save interval: `setInterval(60_000)`, only fires when `autoSave && fileHandle`; updates `lastSaved`
  - `showFileLoadPrompt` — initialised from URL param if `currLayer` not in localStorage
- **`components/Toolbar.tsx`** — added: Save button, Auto Save toggle (green/amber/gray), last-saved time indicator
- **`components/MenuBar.tsx`** — File menu additions: Open File… (⌘O), Save File (⌘S)

### PR-9 — URL Sync / Deep Linking
- **URL format**: `localhost:3000/projects/:projectId?currLayer=:layerId`
- **Route**: New `app/projects/[projectId]/page.tsx` (Server Component) renders `<DiagramPage projectId={...} />`
- **`app/page.tsx`** now redirects to `/projects/local` (default project)
- **`components/DiagramPage.tsx`**: Extracted client component (was `app/page.tsx`) with two additions:
  1. **Init navStack from URL** — `useState` lazy init reads `window.location.search` for `currLayer` param; calls `getLayerPath(layers, currLayerId)` to reconstruct full breadcrumb nav stack from any deep layer
  2. **Sync URL on navigate** — `useEffect([currentLayerId])` calls `window.history.replaceState` so URL always reflects active layer without triggering a page re-render
- **`getLayerPath`** already in `lib/layerStore.ts` — walks parent chain from root to any layerId, returns `Layer[]`; used to rebuild navStack on URL load
- **Breadcrumbs auto-populated**: navStack rebuilt from `getLayerPath` → `LayerBar` breadcrumbs correct on deep-link load
- **Same project file assumption**: `projectId` in URL is structural; all data loads from the single `drafter_layers` localStorage key

### PR-8 — Menu Bar, AI Chat Panel, Docked Layers
- **MenuBar** (`components/MenuBar.tsx`): App-style menu bar at top of page with dropdowns for File, View, AI, and About
  - **File menu**: New (clears + opens AI chat), Open/Import JSON, Export JSON, Save as Image, Import Project, Export Project
  - **View menu**: Toggle Layers Panel (docked to right sidebar)
  - **AI menu**: Open AI Assistant chat panel
  - **About**: Modal showing "DRAFTER v0.1 Alpha" with branding
- **Toolbar simplified**: Removed logo, import/export, layers button — now only zoom in/out/fit + clear canvas (`components/Toolbar.tsx`)
- **AIChatPanel** (`components/AIChatPanel.tsx`): Floating AI chat window fixed to bottom-right
  - Opens automatically on page load and after File > New
  - Conversation-style UI with user/assistant message bubbles
  - Example prompts shown with welcome message
  - If canvas has existing nodes: asks whether to generate on current layer or new layer
  - Minimize to bottom tab (shows "AI Assistant ▲"); close to hide
  - `onGenerateNewLayer(prompt, layerName)` creates a standalone layer, navigates to it, then generates
- **LayersPanel docked mode**: Added `docked?: boolean` prop — when true, renders as a `w-64` right sidebar (no modal backdrop); when false, keeps existing modal behavior
- **`createStandaloneLayer`** added to `lib/layerStore.ts` — creates a top-level layer with `parentLayerId=ROOT_LAYER_ID, parentNodeId=null`
- **Layout order**: MenuBar (h-9) → Toolbar (h-10) → LayerBar → main content row
- **Right sidebar**: When `showLayersPanel` is true, LayersPanel docks to right; PropertiesPanel/EdgePropertiesPanel overlay it (`absolute inset-0 z-10`) when a node/edge is selected

### PR-4 — Z-order, Grouping, Transparent Fill, Edge Properties, Root Bug Fix
- **Send to Front/Back**: right-click → "Bring to Front" / "Send to Back" — adjusts `zIndex` on node
- **Group/Ungroup**: select 2+ nodes → right-click → "Group N nodes" — true React Flow parent-child containment; right-click group → "Ungroup"
- **Transparent fill**: `∅` button in Fill color picker (`fillColor: 'transparent'`)
- **Edge properties panel**: click an edge → `EdgePropertiesPanel` sidebar with label, arrow direction (→/←/↔/—), stroke color
- **Edge markers**: `EDGE_MARKER_START` added to `lib/diagramUtils.ts` for backward/bidirectional arrows
- **Root layer rename bug**: Root layer (`ROOT_LAYER_ID`) renders as plain text in LayersPanel — cannot be renamed
- **Convention**: CLAUDE.md is updated on every code change

---

## Key File Map
| File | Purpose |
|------|---------|
| `app/page.tsx` | Redirects to `/projects/local` |
| `app/projects/[projectId]/page.tsx` | Server Component route wrapper — passes `projectId` to `DiagramPage` |
| `components/DiagramPage.tsx` | Main client component — all state, handlers, URL sync, context wiring |
| `lib/types.ts` | `NodeType`, `NodeData`, `DiagramEdge`, `GenerateResponse` |
| `lib/layerStore.ts` | Layer CRUD + localStorage persistence |
| `lib/canvasContext.ts` | React context shared with all node components |
| `lib/nodeConfig.ts` | `PALETTE_ITEMS`, `LINE_NODE_TYPES` |
| `lib/diagramUtils.ts` | `generateId`, `toReactFlowNodes/Edges`, `EDGE_MARKER`, `EDGE_MARKER_START` |
| `components/DiagramCanvas.tsx` | React Flow wrapper, copy/paste, type-to-edit, addNodeAtCenter, z-order, group/ungroup, edge CRUD |
| `components/PropertiesPanel.tsx` | Right sidebar for selected node properties + colors (incl. transparent fill) |
| `components/EdgePropertiesPanel.tsx` | Right sidebar for selected edge (label, arrow direction, color) |
| `components/NodePalette.tsx` | Left sidebar, collapsible, click/drag to add |
| `components/MenuBar.tsx` | App-style menu bar — File/View/AI/About dropdowns (incl. Open File, Save File) |
| `components/AIChatPanel.tsx` | Floating AI chat panel (bottom-right); minimizable |
| `components/FileLoadPrompt.tsx` | Modal shown when URL layer not found locally — prompts file open |
| `lib/fileStore.ts` | File System Access API utilities: open, write, save-as, download fallback |
| `components/LayersPanel.tsx` | Modal OR docked right sidebar for all layers (`docked` prop) |
| `components/LayerBar.tsx` | Breadcrumb navigation bar |
| `components/Toolbar.tsx` | Zoom controls + clear (simplified) |
| `components/nodes/EditableLabel.tsx` | Inline label editor (context-driven) |
| `components/nodes/ChildLayerBadge.tsx` | Badge shown on nodes with child layers |
| `components/nodes/RotateHandle.tsx` | Drag-to-rotate handle rendered inside all nodes |
| `components/nodes/LineEndpointHandle.tsx` | Draggable endpoint dot for line/arrowline/dottedline nodes |
| `components/nodes/*.tsx` | 21 node types (12 cloud + 9 shape) |
| `lib/diffEngine.ts` | Pure diff computation: `diffProjects(left, right): ProjectDiff`; `DiffStatus`, `NodeDiff`, `LayerDiff` |
| `components/DiffPage.tsx` | Split-view diff UI at `/diff`; file loading (DropZone), diff state |
| `components/DiffCanvas.tsx` | Read-only React Flow canvas with `diffNode` renderer; diff status overlays |
| `components/DiffLayersPanel.tsx` | Layer list with diff status badges, change counts, legend |
| `app/diff/page.tsx` | Server Component route → `<DiffPage />` |

## Verification Commands
```bash
npx tsc --noEmit   # must be 0 errors
npm run build      # must complete successfully
```
