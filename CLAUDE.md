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

### ExtendedRFInstance (`components/DiagramCanvas.tsx`)
Extends `ReactFlowInstance` with custom methods stored on `rfInstanceRef`:
- `loadDiagram`, `clearDiagram`, `updateNodeData`, `deleteNode`, `addNodeAtCenter`
- `bringToFront`, `sendToBack` — adjust `zIndex` relative to current min/max
- `groupNodes(nodeIds)` — calc bounding box, create GroupNode, set `parentNode`+`extent:'parent'` on children
- `ungroupNode(groupId)` — restore absolute positions, remove `parentNode`/`extent`
- `updateEdge(edgeId, updates)` — partial edge update
- `deleteEdge(edgeId)` — remove edge by ID

### Node Color System (`lib/types.ts` → node files)
Each `NodeData` carries optional `borderColor`, `fillColor`, `textColor` (CSS color strings).
Nodes apply these via **inline styles** that override Tailwind defaults:
```tsx
style={{ borderColor: data.borderColor || undefined, backgroundColor: data.fillColor || undefined }}
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
| `app/page.tsx` | Root component — all state, handlers, context wiring |
| `lib/types.ts` | `NodeType`, `NodeData`, `DiagramEdge`, `GenerateResponse` |
| `lib/layerStore.ts` | Layer CRUD + localStorage persistence |
| `lib/canvasContext.ts` | React context shared with all node components |
| `lib/nodeConfig.ts` | `PALETTE_ITEMS`, `LINE_NODE_TYPES` |
| `lib/diagramUtils.ts` | `generateId`, `toReactFlowNodes/Edges`, `EDGE_MARKER`, `EDGE_MARKER_START` |
| `components/DiagramCanvas.tsx` | React Flow wrapper, copy/paste, type-to-edit, addNodeAtCenter, z-order, group/ungroup, edge CRUD |
| `components/PropertiesPanel.tsx` | Right sidebar for selected node properties + colors (incl. transparent fill) |
| `components/EdgePropertiesPanel.tsx` | Right sidebar for selected edge (label, arrow direction, color) |
| `components/NodePalette.tsx` | Left sidebar, collapsible, click/drag to add |
| `components/LayersPanel.tsx` | Modal for all layers — rename/describe/navigate |
| `components/LayerBar.tsx` | Breadcrumb navigation bar |
| `components/Toolbar.tsx` | Top bar with zoom, export, import, layers |
| `components/nodes/EditableLabel.tsx` | Inline label editor (context-driven) |
| `components/nodes/ChildLayerBadge.tsx` | Badge shown on nodes with child layers |
| `components/nodes/*.tsx` | 21 node types (12 cloud + 9 shape) |

## Verification Commands
```bash
npx tsc --noEmit   # must be 0 errors
npm run build      # must complete successfully
```
