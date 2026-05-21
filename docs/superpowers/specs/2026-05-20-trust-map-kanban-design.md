# Trust Map — Kanban View of Trust Boundaries

**Status:** Approved design — ready for implementation plan
**Date:** 2026-05-20
**Branch:** `feat/kanban-for-nodes`
**App:** `apps/frontend`

## Goal

Add a read-only secondary page that renders the project's trust boundaries as a horizontal kanban-style view. Each column is a `TrustBoundary` node; cards inside it are the nodes contained by that boundary. Cross-boundary edges render as arrows over the columns. A right-side panel surfaces STRIDE threats associated with cross-boundary flows. Clicking a card jumps the user back to the canvas at the right layer with the node selected.

This view gives security-minded users a single screen to scan trust-zone composition and cross-boundary risk for the entire project, without manually traversing layers.

## Non-goals

- No drag-and-drop reassignment of nodes between boundaries (read-only).
- No new AI analysis from this page (reuses saved threat models only).
- No new backend endpoints.
- No editing of boundaries, nodes, edges, or threats from this view.
- No score/posture meter (deferred — show raw counts first).

## Architecture

New route `/projects/:projectId/trust-map`. Standard secondary-page top-bar pattern (`h-9` header, Layers logo, back button, project context, theme cycle, user email, LogOut) per `apps/frontend/CLAUDE.md`.

### Files

```
apps/frontend/
  app/projects/[projectId]/trust-map/page.tsx       # server route → client component
  components/TrustMapPage.tsx                       # client root: top bar, data load, layout
  components/trust-map/
    KanbanColumn.tsx                                # one column per TrustBoundary
    NodeCard.tsx                                    # card per contained node
    FlowOverlay.tsx                                 # SVG cross-boundary arrows
    BoundaryAnalysisPanel.tsx                       # right-side STRIDE list
  lib/trustMap.ts                                   # pure aggregation logic
  lib/trustMap.test.ts                              # unit tests for aggregation
```

### Data load (client-side, on mount)

1. `apiGetProject(projectId)` → full `ProjectFile` with `LayerMap`.
2. `apiListThreatModels(projectId)` → latest saved `ThreatModel` + threats.
3. Build `TrustMapView` from `lib/trustMap.ts` (pure).

No backend changes. All required data already exposed.

## Aggregation (`lib/trustMap.ts`)

Pure functions. Inputs: `LayerMap`, `Threat[]`. Output: `TrustMapView`.

### Types

```ts
export type TrustLevel = 'internet' | 'external' | 'dmz' | 'internal' | 'custom';

export interface TrustMapColumn {
  boundaryId: string;        // TrustBoundary node id
  layerId: string;           // layer that owns the boundary
  label: string;             // boundary.data.label
  trustLevel: TrustLevel;
  cards: TrustMapCard[];
}

export interface TrustMapCard {
  nodeId: string;
  layerId: string;
  label: string;
  nodeType: string;          // NodeType
  subtitle?: string;         // derived tech detail
  containedBy: 'parent' | 'geometric' | 'both';
}

export interface TrustMapFlow {
  edgeId: string;
  sourceCardKey: string;     // `${layerId}:${nodeId}`
  targetCardKey: string;
  sourceBoundaryId: string;
  targetBoundaryId: string;
  threats: Threat[];         // matched by edge id
  highestSeverity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

export interface TrustMapView {
  columns: TrustMapColumn[]; // sorted by trustLevel rank: internet → external → dmz → internal → custom
  flows: TrustMapFlow[];
  unboundedNodes: TrustMapCard[]; // shown as trailing "Unassigned" column when non-empty
}
```

### Algorithm

1. Walk every layer in `LayerMap`. Collect every node with `nodeType === 'trustboundary'`. Each becomes one column.
2. For each boundary, walk every layer's nodes. A node becomes a card in that column if either:
   - **Parent rule:** `node.parentNode === boundary.id` and the node is on the same layer.
   - **Geometric rule:** node is on the same layer as the boundary, and node xy + width/height falls inside the boundary's rect.
   - Tag `containedBy` accordingly (`'parent'`, `'geometric'`, or `'both'` if both rules match).
3. Build `cardKey → boundaryId` index for cross-boundary edge detection (key = `${layerId}:${nodeId}`).
4. Walk all edges across all layers. If both endpoints exist in the index **and** map to different boundary ids → emit a `TrustMapFlow`. Attach all threats whose `edgeId` matches.
5. Any node never assigned to a column (and not a boundary itself) → `unboundedNodes`.
6. Sort columns by trust level rank, then by label.

**Single-assignment rule:** each node is assigned to at most one column. Resolution order:
1. If `node.parentNode` matches any boundary, assign to that boundary (parent rule wins).
2. Else, among all boundaries whose rect geometrically contains the node, assign to the boundary with the smallest area (innermost containment wins).
3. Else, node becomes an `unboundedNode`.

### Severity rollup

`highestSeverity` = max severity across attached threats, using rank: `critical > high > medium > low > info`.

## Layout

```
┌────────────────────────────────────────────────────────────────────┐
│ Top bar (h-9, standard secondary-page pattern)                     │
├──────────────────────────────────────────────┬─────────────────────┤
│ Header: "<project> — trust map"              │ Boundary analysis   │
│  "AI reading N nodes · M flows"              │ (right panel)       │
├──────────────────────────────────────────────┤                     │
│ ┌─Col─┐ ┌─Col─┐ ┌─Col─┐ ┌─Col─┐  scroll-x →  │ STRIDE summary      │
│ │card │ │card │ │card │ │card │              │ Threat cards list   │
│ │card │ │card │ │card │ │card │              │ (severity badges)   │
│ └─────┘ └─────┘ └─────┘ └─────┘              │                     │
│   ← FlowOverlay SVG absolute over columns →  │                     │
└──────────────────────────────────────────────┴─────────────────────┘
```

- Main area: horizontal scroll for >4 columns. Columns ~240px wide; card list scrolls vertically inside the column.
- Right panel: fixed ~340px, full-height, scrollable. Mirrors `ThreatModelPanel` styling.
- Card colors borrow `TRUST_LEVEL_CONFIG` border/badge palette from `components/nodes/TrustBoundaryNode.tsx`.
- Dark mode supported via existing `dark:` tailwind variants.

## FlowOverlay (SVG)

- Absolute-positioned `<svg>` covering the kanban region.
- Each `TrustMapFlow` rendered as one `<path>` with a cubic bezier from the source card's right edge to the target card's left edge.
- Card DOM rects computed via `getBoundingClientRect` relative to the scroll container.
- Path stroke color is keyed off `highestSeverity` (critical/high → red, medium → amber, low/info → slate, none → muted gray).
- Recompute paths on: window resize, container scroll, card-list scroll, data change. Use `ResizeObserver` on the container + `requestAnimationFrame` throttle.
- Click a path → highlight + scroll the right panel to the first matching threat.
- Hover a card → highlight matching flow paths.
- Bidirectional highlight pattern follows PRD 4 (`components/ThreatOverlay.tsx`).

## Card interactions

- Click a card → `router.push('/projects/:projectId?currLayer=<layerId>&selectNode=<nodeId>')`.
- Requires small addition to `DiagramPage`: read `selectNode` query param on mount and call the existing selection setter.
- Card content: node-type icon, label, subtitle (`data.subtitle ?? data.tech ?? nodeType`), and a small "layer: <name>" pill so the user sees which layer the node lives in.

## Boundary analysis panel

- Header: total threat counts by severity (critical / high / medium / low) for the visible flows. (Score deferred.)
- For each cross-boundary pair (e.g. "INTERNET → DMZ") that has threats, render a section with the filtered threats. Each row uses a compact variant of `ThreatResultCard` (severity badge, STRIDE letter, title, one-line description).
- Click a threat row → highlight the corresponding flow path; flow click reverse-highlights the threat row.
- Footer link: "View all threats" → `/projects/:projectId/threats`.

## Empty / edge cases

- **No `trustboundary` nodes anywhere in the project:** empty state with a CTA: "Add a Trust Boundary node in your diagram." + link back to the canvas.
- **No threats loaded:** analysis panel shows "Run threat analysis" link → canvas with `AIChatPanel` open.
- **Same trust level on multiple boundaries:** rendered as separate columns, ordered by layer depth then label. Trust level only drives color, never grouping.
- **Published (read-only) project:** page works identically — already a read-only view.
- **Boundary with zero cards:** still rendered as an empty column with an "empty" hint, so users see the zone exists.
- **Unbounded nodes:** if any exist, show trailing "Unassigned" column at the end with muted styling.

## Testing

- Unit tests for `lib/trustMap.ts`:
  - parent-only containment
  - geometric-only containment
  - both rules match (prefer parent, no duplicate card)
  - cross-boundary edge detection produces a flow
  - intra-boundary edge does not produce a flow
  - unbounded nodes captured
  - severity rollup picks max severity
  - column sort order honors trust-level rank
- No e2e — UI is read-only. Visual smoke check in dev required before merge.

## Verification

```bash
cd apps/frontend
npx tsc --noEmit          # must be 0 errors
npm run build             # must complete successfully
npm test -- trustMap      # aggregation unit tests pass (if test runner configured; otherwise run via node tap or skip per app conventions)
```

Manual: load a project with at least two trust boundaries across multiple layers, with at least one saved threat model. Verify:
- Columns render in trust-level order.
- Cards appear in the correct columns (both parent and geometric containment).
- Cross-boundary edges render as arrows.
- Clicking a card navigates to the canvas with the right layer and node selected.
- Clicking a threat highlights the matching arrow and vice versa.
- Dark mode and light mode both look right.

## Risks / open considerations

- **DOM measurement timing:** `FlowOverlay` paths depend on card rects. Initial render may need a frame delay before measuring. Use `useLayoutEffect` + `requestAnimationFrame`.
- **Overlapping boundaries on same layer:** parent rule wins; geometric duplicates skipped. If users have nested boundaries, innermost wins by virtue of `parentNode` if set; otherwise the smallest-area containing boundary should win for geometric matches. Implementation must sort candidate boundaries by area ascending before assigning.
- **Cross-layer edges:** in this project, edges always live on one layer (a layer owns its edges). A "cross-boundary" flow therefore necessarily occurs within a single layer's edge set. The aggregation walks edges per layer and matches both endpoints against the cross-layer card index — but since both endpoints of any one edge share a layer, both will resolve to cards on that same layer. Cross-layer connections do not exist as edges, so they are not represented in this view (acceptable, matches the data model).
