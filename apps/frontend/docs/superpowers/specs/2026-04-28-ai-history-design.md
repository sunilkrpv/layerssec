# AI History — UX Redesign Spec

**Date:** 2026-04-28
**Status:** Approved (pending plan)
**Owners:** Frontend (Layers)
**Related:** `feat/ux-foundations` (shared primitives), `feat/ux-diagram-chrome`, `feat/threats-dashboard-redesign`, `feat/projects-list-redesign` (chrome conventions)

---

## Goal

Replace the existing 1300-line `AIHistoryPage` monolith with a clearer, more focused UX that adopts the chrome conventions established in the diagram-chrome, threats-dashboard, and projects-list migrations. The Layers sidebar becomes collapsible with persistent preference, multi-layer attach (cap 3) replaces single-attach, the Apply Diagram modal becomes a right-docked drawer, `MiniDiagramPreview` gains a full-screen option, and the monolith splits into focused per-component files. Per-message model + token chips stay.

---

## Decisions

| Topic | Decision |
|-------|----------|
| Layers sidebar | Collapsible — default-shown, can collapse to a 32px rail; preference persisted in `localStorage[ai_history_sidebar_collapsed]` |
| Attach context | Multi-attach with a cap of 3 layers; UI-only (backend doesn't read attached layer — RAG handles context) |
| Apply diagram flow | Right-docked drawer (replaces modal); chat column reflows narrower while drawer is open |
| Per-message metadata chips | Keep |
| Layer preview popup | Keep — Eye click on tree shows floating `MiniDiagramPreview` |
| Delivery | Big-bang rewrite on a single feature branch via subagent-driven plan |
| `MiniDiagramPreview` | ability for full screen option |

---

## 1. Routes + page-level structure

Single existing route — `/projects/:projectId/ai-history`. No new routes.

**Page chrome (top to bottom):**
1. **Top bar** (`h-9`, secondary-page convention; already conformant — keep): Layers logo · Back-to-diagram · vertical divider · Sparkles + project name · spacer · message count + **New conversation** button · theme cycle · user / sign-out
2. **Body row** (flex-1 overflow-hidden):
   - **Layers sidebar** (left, default-shown, collapsible): expanded ≈ 208px wide with `LayerTreeNode` recursive tree (Eye + Paperclip per leaf); collapsed ≈ 32px rail with a small chevron to expand
   - **Chat column** (flex-1): scrollable message list (convo separators, user/assistant bubbles, markdown via shared `mdComponents`, `DiagramBubble` for diagram payloads) + composer (attached-layer chip row + textarea + send)
3. **`LayerPreviewPopup`** (kept; floating; anchored to Eye click)
4. **`ApplyDiagramDrawer`** (NEW; right-docked, 384px, replaces `ApplyDiagramModal`; chat column reflows narrower while drawer is open)

---

## 2. Component breakdown

| File | Approx. lines | Purpose |
|------|---------------|---------|
| `components/AIHistoryPage.tsx` | ~250 | Orchestrator — page chrome, fetch, multi-attach state, drawer state, send |
| `components/ai-history/LayersSidebar.tsx` | ~140 | Sidebar shell — header + collapse toggle + tree; reads/writes `localStorage[ai_history_sidebar_collapsed]` |
| `components/ai-history/LayerTreeNode.tsx` | ~90 | Existing recursive tree node — extracted as-is |
| `components/ai-history/LayerPreviewPopup.tsx` | ~70 | Existing floating popup with `MiniDiagramPreview` — extracted as-is |
| `components/ai-history/DiagramBubble.tsx` | ~120 | Preview/Hide toggle + Maximize + Apply → button |
| `components/ai-history/ApplyDiagramDrawer.tsx` | ~250 | NEW — replaces `ApplyDiagramModal`; layer dropdown + node link + confirm |
| `components/ai-history/ChatMessage.tsx` | ~150 | User + assistant bubbles; markdown render; `DiagramBubble` slot; layer-tag badge; keeps model + token chips |
| `components/ai-history/ChatComposer.tsx` | ~130 | Multi-attach chip row (cap 3) + textarea + send button |
| `lib/aiHistoryHelpers.ts` | ~70 | `splitDiagramContent`, `formatTime`, `formatDate`, `isSameDay`, `DIAGRAM_SEP` constant |
| `lib/markdownRenderers.ts` | ~140 | Shared `mdComponents` + `CopyableCodeBlock` (extracted from monolith) |

**Drop entirely:**
- `ApplyDiagramModal` (replaced by drawer)

**New capability — `MiniDiagramPreview` full-screen mode:**

Both `LayerPreviewPopup` and `DiagramBubble` use `MiniDiagramPreview` (read-only React Flow render). Add a Maximize button (top-right corner of the preview canvas) that opens a full-screen modal showing the same diagram at full viewport size with a Close (✕) button and Esc-to-close. Keep the existing inline preview behavior unchanged when the user does not maximize.

Implementation note: a single `<MaximizeOverlay>` component (top-level in `AIHistoryPage`) reads a shared piece of state — `maximizedDiagram: { nodes, edges, layerName? } | null` — and renders the full-screen overlay when set. `LayerPreviewPopup` and `DiagramBubble` each receive an `onMaximize(payload)` callback wired to set this state. This keeps maximize behavior centralized and avoids two competing modals.

**Primitives reused:** `Button`, `IconButton`, `EmptyState`, `Tooltip`, `DropdownMenu`, `StatusPill`.

The threat detail page (`components/ThreatDetailPage.tsx`) carries its own `mitigationMdComponents` — leave it alone in this plan; do not migrate it to `lib/markdownRenderers.ts` here.

---

## 3. State + data flow

### Page state (orchestrator)

```ts
const [projectName, setProjectName] = useState<string | null>(null);
const [diagramId, setDiagramId] = useState<string | null>(null);
const [diagramLayers, setDiagramLayers] = useState<LayerMap | null>(null);
const [uiItems, setUiItems] = useState<UiItem[]>([]); // tagged union; preserved as-is from the existing
                                                       // monolith. Discriminator on `kind`:
                                                       //   { kind: 'message',   data: ChatMessage }
                                                       //   { kind: 'streaming', content: string }
                                                       //   { kind: 'separator' }
const [isLoading, setIsLoading] = useState(true);
const [isStreaming, setIsStreaming] = useState(false);
const [error, setError] = useState<string | null>(null);

const [attachedLayers, setAttachedLayers] = useState<Layer[]>([]); // cap 3
const [maximizedDiagram, setMaximizedDiagram] = useState<MaximizedPayload | null>(null);
const [previewLayerId, setPreviewLayerId] = useState<string | null>(null);
const [previewAnchorRect, setPreviewAnchorRect] = useState<DOMRect | null>(null);
const [expandedLayerIds, setExpandedLayerIds] = useState<Set<string>>(new Set());

const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem('ai_history_sidebar_collapsed') === '1';
});

const [applyTarget, setApplyTarget] = useState<DiagramPayload | null>(null);
const [input, setInput] = useState('');
```

### Multi-attach (cap 3) semantics

- **Toggle:** Paperclip on layer X — if X is already attached, remove. If not attached and `attachedLayers.length < 3`, add. If at cap, the Paperclip on un-attached layers is **disabled** with `Tooltip` "Up to 3 layers".
- **Chip row** in composer shows each attached layer with an X to clear.
- **Persisted message tag:** the assistant message's `layerId` / `layerName` fields hold `attachedLayers[0]` (the first attached layer) for backward compatibility with the `ChatMessage` schema. The full attached set (up to 3) is rendered as additional badges on the assistant bubble UI but is not persisted to the backend (single-field schema).
- **Prompt prefix:** when `attachedLayers.length > 0`, prepend a one-line hint to the user prompt before sending: `Layers in scope: <name1>[, <name2>][, <name3>]\n\n` followed by the user's actual input. The visible bubble shows only the user's typed input — not the hint.
- **Backend integration:** none. `apiContextualChatAsk` doesn't read attached layers; multi-attach is purely a UI label and a prompt-prefix hint.

### Send flow

```
1. User types + Send (or Enter without Shift).
2. Build prompt: prefix with "Layers in scope: …" if any attached.
3. Push fakeUserMsg + streaming placeholder to uiItems.
4. setIsStreaming(true).
5. apiContextualChatAsk({ message, projectId, diagramId, history }, onChunk).
6. On each chunk: append to streamingRef + update streaming placeholder.
7. After done: splitDiagramContent → text + maybe diagramPayload.
8. Replace streaming with persisted assistant message; layerId/layerName = attachedLayers[0] (or null).
9. setIsStreaming(false).
```

### Apply drawer flow

- `applyTarget` (DiagramPayload) opens the drawer.
- Drawer owns local state: `targetMode: 'override' | 'new'`, `targetLayerId: string | null`, `newLayerName: string`, `linkNodeId: string | null`, `applying: boolean`, `error: string | null`.
- Confirm enabled only when valid: override needs a `targetLayerId`; new needs a non-empty `newLayerName`.
- On confirm: parent's `handleApplyDiagram(target)` runs; on success the drawer closes.

### Persisted history

- `apiGetChatHistory(projectId)` on mount as today.
- New conversation button appends a `{ kind: 'separator' }` marker to `uiItems`. Doesn't hit the API.

### `beforeunload` guard

Existing pattern: blocks page unload while `isStreaming`. Keep as-is.

---

## 4. Apply drawer UX

Right-docked drawer (`fixed inset-y-0 right-0 w-96`, full-height under top bar). Replaces `ApplyDiagramModal`.

```
┌────────────────────────────────────────────┐
│  Apply diagram                          ✕ │
│  3 nodes · 4 edges · 1 trust boundary      │
├────────────────────────────────────────────┤
│  ── Preview ───────────────────────────    │
│  [MiniDiagramPreview — read-only flow]     │
│                                             │
│  ── Target ────────────────────────────    │
│  ◉ Override existing layer                  │
│      [DropdownMenu — layer list]            │
│  ○ Create new layer                         │
│      [name input — required when chosen]    │
│                                             │
│  ── Link to node (optional) ──────────     │
│  [DropdownMenu — pick node from current     │
│   layer; "None" default; only shown when    │
│   target = "Create new layer"]              │
│                                             │
│  ── Notes ────────────────────────────     │
│  Override replaces the layer's nodes/edges. │
│  Linking attaches the new layer as a child  │
│  of the picked node (drill-down).            │
│                                             │
├────────────────────────────────────────────┤
│  [Cancel]                [Apply diagram]    │
└────────────────────────────────────────────┘
```

### Behavior

- **Default target:** override-existing with `targetLayerId` defaulted to `attachedLayers[0]?.id` (first attached layer) if present, otherwise the root layer. The user can change the radio to "Create new layer".
- **Override:** dropdown lists every layer in `diagramLayers` keyed by id. On Apply, parent overrides that layer's nodes/edges with the new payload.
- **New layer:** name input (required, min 1 char, max 64). On Apply, parent creates a new layer with the given name; if a `linkNodeId` was picked, the new layer is attached as a drill-down child of that node.
- **Link-to-node mutex:** the picker is hidden unless target is `Create new layer`.
- **Outside-click and Escape close** the drawer (only when not currently applying).
- **During apply:** the confirm button shows a spinner; Cancel and target controls are disabled.
- **Error:** inline red banner above the footer; drawer stays open.
- **Chat reflow:** chat column has `flex-1 min-w-0` and the drawer is `flex-shrink-0` so chat narrows automatically while the drawer is open.

---

## 5. Sidebar collapse + persistence

The toggle button lives in the sidebar header. Click flips `sidebarCollapsed`; the new value persists to `localStorage[ai_history_sidebar_collapsed]` ('1' | absent — '0' is treated as absent so the value is canonical).

### Expanded state (default, 208px)

```
┌──────────────────────────┐
│ LAYERS              ◀    │
├──────────────────────────┤
│ ▸ Root                   │
│   ▾ API gateway          │
│     • auth-svc        👁 📎│
│     • user-svc        👁 📎│
│   ▸ Internal services    │
└──────────────────────────┘
```

### Collapsed state (32px rail)

```
┌──┐
│ ▶│   ← Tooltip: "Show layers"
└──┘
```

### Behavior

- `expandedLayerIds` (which tree branches are open) persists across collapse / expand toggles via component state.
- `LayerPreviewPopup` (triggered by the Eye icon) anchors to the click target, not the sidebar — unaffected by collapse state.
- The Paperclip in the sidebar is the **only** Paperclip surface; there is no inline "attach this layer" action elsewhere in the page.

---

## 6. Empty / loading / error states

| State | Surface |
|-------|---------|
| Initial load | "Loading history…" plain text centered in chat column |
| 0 messages, no error | `EmptyState` primitive: MessageSquare icon, "No AI conversations yet", subtext "Attach a layer from the sidebar, then ask a question or request changes." |
| API error on history fetch | Red banner in chat column with retry CTA |
| Streaming in progress | `ThinkingDots` while no chunks have arrived; chunks render as they arrive; markdown re-rendered on each chunk |
| Apply drawer error | Inline red banner inside drawer; drawer stays open |
| Cap hit on attach (3 layers attached) | Disabled Paperclip on un-attached layers; `Tooltip` "Up to 3 layers" |
| Maximize preview | Esc closes; clicking the page's overlay background also closes; only one maximized preview at a time |

---

## 7. Backend dependency

None. `apiContextualChatAsk` already supports the call shape used today. Multi-attach is purely a UI label and a prompt-prefix hint — backend uses RAG retrieval over project state via `diagramId`, not attached layers.

---

## 8. Out of scope

- Branching conversations (fork from a message)
- Message search / filter
- Persist attached-layer state across page reloads
- Per-message regenerate
- Export chat as markdown
- Migrating `mitigationMdComponents` from the threat detail page to `lib/markdownRenderers.ts`
- Tests — no test infrastructure in this repo today; manual verification only

---

## 9. Quality gates (per implementation task)

- `npx tsc --noEmit` → 0 errors
- `npm run build` → "Compiled successfully"
- **Do not** run `npm run lint` — pre-existing broken in Next 16 at the repo level
- Manual: every visible surface verified in both light and dark mode (`html.dark` toggle), including the sidebar collapsed AND expanded, the drawer open AND closed, the chip row with 1 / 2 / 3 attached layers, and the `MiniDiagramPreview` full-screen overlay (Esc + ✕ close)
