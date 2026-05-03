# AI History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 1300-line `AIHistoryPage` monolith with focused per-component files under `components/ai-history/`, add collapsible Layers sidebar with persisted preference, multi-attach (cap 3) layer context, right-docked Apply Diagram drawer (replaces modal), and a centralized full-screen `MiniDiagramPreview` overlay.

**Architecture:** Decompose the monolith into focused per-component files. The page becomes a slim orchestrator that owns sidebar collapse state, multi-attached-layer state, drawer state, and a centralized `maximizedDiagram` state. The `LayersSidebar`, `DiagramBubble`, and `LayerPreviewPopup` all dispatch maximize via a single callback, so only one overlay can be open at a time. Helpers move into `lib/aiHistoryHelpers.ts`; the markdown renderer block moves into `lib/markdownRenderers.ts`. Per-message metadata chips (model + token counts) stay; the `ApplyDiagramModal` is retired in favor of `ApplyDiagramDrawer`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS v3 (`darkMode: 'class'`), `react-markdown` + `remark-gfm`, `lucide-react`, dynamic-imported `MiniDiagramPreview` (React Flow). Shared primitives: `Button`, `IconButton`, `Tooltip`, `EmptyState`, `DropdownMenu`.

**Branch:** `feat/ai-history-redesign` (already created, holds the design spec at `6175f14`).

**Quality gates per task:**
- `npx tsc --noEmit` → 0 errors
- `npm run build` → "Compiled successfully"
- **Do NOT** run `npm run lint` — pre-existing broken in Next 16 at the repo level
- Manual: every visible surface verified in both light and dark mode where applicable

---

## Task 1: Extract `lib/aiHistoryHelpers.ts`

**Files:**
- Create: `lib/aiHistoryHelpers.ts`
- Modify: `components/AIHistoryPage.tsx` (delete inline definitions, add import)

**Context:** The monolith carries `formatDate`, `formatTime`, `isSameDay`, `DIAGRAM_SEP`, and `splitDiagramContent` inline (lines ~127–173). Several upcoming files need them. Centralize.

- [ ] **Step 1: Create `lib/aiHistoryHelpers.ts` with this exact content**

```ts
export interface DiagramPayload {
  nodes: unknown[];
  edges: unknown[];
}

export const DIAGRAM_SEP = '---DIAGRAM---';

export function formatChatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatChatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** Split streamed/stored text into display text + optional diagram JSON.
 *  Handles both the ---DIAGRAM--- separator protocol and fallback markdown code blocks. */
export function splitDiagramContent(raw: string): { text: string; diagram: DiagramPayload | null } {
  const idx = raw.indexOf(DIAGRAM_SEP);
  if (idx !== -1) {
    const text = raw.slice(0, idx).trim();
    const jsonStr = raw.slice(idx + DIAGRAM_SEP.length).trim();
    try {
      const parsed = JSON.parse(jsonStr) as DiagramPayload;
      if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        return { text, diagram: parsed };
      }
    } catch { /* ignore */ }
    return { text: raw, diagram: null };
  }

  // Fallback: last ```json … ``` code block that parses to { nodes, edges }
  const codeBlockMatches = Array.from(raw.matchAll(/```(?:json)?\s*\n?([\s\S]*?)```/gi));
  if (codeBlockMatches.length > 0) {
    const lastMatch = codeBlockMatches[codeBlockMatches.length - 1];
    try {
      const parsed = JSON.parse(lastMatch[1].trim()) as DiagramPayload;
      if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        const text = raw.slice(0, lastMatch.index).trim();
        return { text, diagram: parsed };
      }
    } catch { /* not a diagram JSON block */ }
  }

  return { text: raw, diagram: null };
}
```

- [ ] **Step 2: Update `components/AIHistoryPage.tsx`**

- Delete the inline `function formatDate`, `function formatTime`, `function isSameDay`, `const DIAGRAM_SEP`, and `function splitDiagramContent`.
- Delete the inline `interface DiagramPayload` (now exported from helpers).
- Add to imports near the top:
  ```tsx
  import {
    DIAGRAM_SEP, formatChatDate, formatChatTime, isSameDay, splitDiagramContent,
    type DiagramPayload,
  } from '@/lib/aiHistoryHelpers';
  ```
- Rename usages in this file: `formatDate(...)` → `formatChatDate(...)` and `formatTime(...)` → `formatChatTime(...)`. `isSameDay`, `DIAGRAM_SEP`, `splitDiagramContent`, `DiagramPayload` keep their names.

- [ ] **Step 3: Verify type check + build**

```bash
cd /Users/sunil/Development/github/layers
npx tsc --noEmit
```
Expected: exit 0.

```bash
npm run build
```
Expected: "Compiled successfully"

- [ ] **Step 4: Commit**

```bash
git add lib/aiHistoryHelpers.ts components/AIHistoryPage.tsx
git commit -m "refactor(ai-history): extract helpers to lib/aiHistoryHelpers"
```

---

## Task 2: Extract `lib/markdownRenderers.ts`

**Files:**
- Create: `lib/markdownRenderers.ts`
- Modify: `components/AIHistoryPage.tsx` (delete inline `CopyableCodeBlock` + `mdComponents`, add import)

**Context:** The monolith carries `CopyableCodeBlock` and the `mdComponents` map inline (lines ~42–123). Move both into a shared module so the chat message component (Task 6) and any future surface can reuse them.

- [ ] **Step 1: Create `lib/markdownRenderers.ts` with this exact content**

```tsx
'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyableCodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  function handleCopy() {
    const text = preRef.current?.textContent ?? '';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="group relative mb-3">
      <pre ref={preRef} className="overflow-x-auto rounded-xl bg-gray-900 p-4 text-xs leading-relaxed ring-1 ring-gray-700/60">
        {children}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-gray-700/80 px-2 py-1 text-[10px] text-gray-300 opacity-0 transition hover:bg-gray-600/80 group-hover:opacity-100"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export const mdComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-2 text-sm leading-relaxed last:mb-0">{children}</p>
  ),
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mb-2 mt-3 text-base font-bold text-gray-900 dark:text-white">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mb-1.5 mt-3 text-sm font-bold text-gray-900 dark:text-white">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-1 mt-2 text-sm font-semibold text-gray-700 dark:text-indigo-100">{children}</h3>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => (
    <em className="italic text-blue-600 dark:text-indigo-200">{children}</em>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-2 ml-4 list-disc space-y-0.5 text-sm">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-0.5 text-sm">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  code: ({ children, className }: { children?: ReactNode; className?: string }) => {
    const isBlock = /language-/.test(className ?? '');
    return isBlock ? (
      <code className={`font-mono text-xs text-gray-100 ${className ?? ''}`}>{children}</code>
    ) : (
      <code className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-xs text-slate-700 dark:bg-indigo-800/60 dark:text-blue-200">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: ReactNode }) => (
    <CopyableCodeBlock>{children}</CopyableCodeBlock>
  ),
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a
      href={href}
      className="text-blue-600 underline decoration-blue-400/50 underline-offset-2 hover:text-blue-500 dark:text-blue-300 dark:decoration-blue-500/40 dark:hover:text-blue-200"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
};
```

- [ ] **Step 2: Update `components/AIHistoryPage.tsx`**

- Delete the inline `function CopyableCodeBlock` (lines ~42–68).
- Delete the inline `const mdComponents = { … }` (lines ~72–123).
- Drop the now-unused `Check` and `Copy` imports from this file (the helpers own them now).
- Add to imports:
  ```tsx
  import { mdComponents } from '@/lib/markdownRenderers';
  ```
- Existing usage `<ReactMarkdown components={mdComponents}>` continues to compile.

- [ ] **Step 3: Verify type check + build**

```bash
cd /Users/sunil/Development/github/layers
npx tsc --noEmit
```
Expected: exit 0.

```bash
npm run build
```
Expected: "Compiled successfully"

- [ ] **Step 4: Commit**

```bash
git add lib/markdownRenderers.ts components/AIHistoryPage.tsx
git commit -m "refactor(ai-history): extract markdown renderers to lib/markdownRenderers"
```

---

## Task 3: Extract `LayerTreeNode` + `LayerPreviewPopup`

**Files:**
- Create: `components/ai-history/LayerTreeNode.tsx`
- Create: `components/ai-history/LayerPreviewPopup.tsx`
- Modify: `components/AIHistoryPage.tsx` (delete inline components, add imports)

**Context:** Pure extraction. Both move as-is. `LayerPreviewPopup` keeps its current Maximize-less behavior in this task; the centralized full-screen overlay arrives in Task 7 (we wire `onMaximize` then).

- [ ] **Step 1: Create `components/ai-history/LayerTreeNode.tsx`**

Copy the existing `LayerTreeNode` function and `LayerTreeNodeProps` interface from `components/AIHistoryPage.tsx` verbatim. Wrap as a named export. The body uses no helpers from outside the monolith except the existing `Layer` / `LayerMap` types and lucide icons.

```tsx
'use client';

import { useRef } from 'react';
import { ChevronRight, Eye, Layers, Paperclip } from 'lucide-react';
import type { Layer, LayerMap } from '@/lib/layerStore';

export interface LayerTreeNodeProps {
  layer: Layer;
  layers: LayerMap;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onPreview: (id: string, rect: DOMRect) => void;
  attachedLayerIds: string[];
  onAttachToggle: (layer: Layer) => void;
  /** Disable the Paperclip button (e.g. when at attach cap and this layer is not attached). */
  attachDisabled: (layer: Layer) => boolean;
}

export function LayerTreeNode({
  layer, layers, depth, expanded, onToggle, onPreview, attachedLayerIds, onAttachToggle, attachDisabled,
}: LayerTreeNodeProps) {
  const children = Object.values(layers).filter((l) => l.parentLayerId === layer.id);
  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(layer.id);
  const isAttached = attachedLayerIds.includes(layer.id);
  const disabled = !isAttached && attachDisabled(layer);
  const rowRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div
        ref={rowRef}
        className={`group flex cursor-pointer items-center gap-1 rounded-lg py-1 pr-1 text-xs transition ${isAttached ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'}`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        title={layer.name}
      >
        <button
          className="flex-shrink-0 rounded p-0.5 hover:bg-gray-200 dark:hover:bg-white/10"
          onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggle(layer.id); }}
        >
          <ChevronRight
            size={11}
            className={`transition-transform text-gray-400 ${hasChildren ? '' : 'opacity-0'} ${isExpanded ? 'rotate-90' : ''}`}
          />
        </button>

        <Layers size={11} className="flex-shrink-0 text-indigo-400 dark:text-blue-500" />
        <span className="min-w-0 flex-1 truncate font-medium">{layer.name || 'Untitled'}</span>

        {layer.nodes.length > 0 && (
          <span className="flex-shrink-0 rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] text-gray-500 dark:bg-white/10 dark:text-gray-400">
            {layer.nodes.length}
          </span>
        )}

        <div className="ml-1 flex flex-shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (rowRef.current) onPreview(layer.id, rowRef.current.getBoundingClientRect());
            }}
            title="Preview layer"
            className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-white/10"
          >
            <Eye size={10} className="text-gray-400" />
          </button>
          <button
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (disabled) return;
              onAttachToggle(layer);
            }}
            title={isAttached ? 'Detach from chat' : disabled ? 'Up to 3 layers' : 'Attach to chat'}
            className="rounded p-0.5 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10"
          >
            <Paperclip size={10} className={isAttached ? 'text-blue-500' : 'text-gray-400'} />
          </button>
        </div>
      </div>

      {isExpanded && children.map((child) => (
        <LayerTreeNode
          key={child.id}
          layer={child}
          layers={layers}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          onPreview={onPreview}
          attachedLayerIds={attachedLayerIds}
          onAttachToggle={onAttachToggle}
          attachDisabled={attachDisabled}
        />
      ))}
    </>
  );
}
```

Note: the props change from `attachedLayerId: string | null` + `onAttach: (Layer) => void` to `attachedLayerIds: string[]` + `onAttachToggle: (Layer) => void` + `attachDisabled: (Layer) => boolean` to support multi-attach (cap 3) — this is the only behavioral change in this extraction. The orchestrator will be updated in Task 10 to provide the new props.

- [ ] **Step 2: Create `components/ai-history/LayerPreviewPopup.tsx`**

```tsx
'use client';

import dynamic from 'next/dynamic';
import { Layers, Maximize2, Paperclip, X } from 'lucide-react';
import type { Layer } from '@/lib/layerStore';

const MiniDiagramPreview = dynamic(() => import('@/components/MiniDiagramPreview'), { ssr: false });

export interface LayerPreviewPopupProps {
  layer: Layer;
  anchorRect: DOMRect;
  isAttached: boolean;
  onAttach: () => void;
  onClose: () => void;
  onMaximize: () => void;
}

export function LayerPreviewPopup({
  layer, anchorRect, isAttached, onAttach, onClose, onMaximize,
}: LayerPreviewPopupProps) {
  const style: React.CSSProperties = {
    position: 'fixed',
    left: anchorRect.right + 8,
    top: Math.min(anchorRect.top, window.innerHeight - 340),
    width: 320,
    zIndex: 60,
  };

  return (
    <div style={style} className="rounded-2xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5 dark:border-white/10 dark:bg-gray-900">
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 dark:border-white/10">
        <Layers size={13} className="flex-shrink-0 text-indigo-400" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800 dark:text-white">
          {layer.name}
        </span>
        <span className="text-[10px] text-gray-400">{layer.nodes.length} nodes</span>
        {layer.nodes.length > 0 && (
          <button
            onClick={onMaximize}
            title="Maximize preview"
            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
          >
            <Maximize2 size={11} />
          </button>
        )}
        <button onClick={onClose} className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10">
          <X size={12} />
        </button>
      </div>

      <div className="h-48 overflow-hidden">
        {layer.nodes.length > 0 ? (
          <MiniDiagramPreview nodes={layer.nodes} edges={layer.edges} className="h-full w-full rounded-none border-0" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-400 dark:text-gray-600">
            Empty layer
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 px-3 py-2 dark:border-white/10">
        <button
          onClick={onAttach}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${isAttached ? 'bg-blue-50 text-blue-600 ring-1 ring-indigo-200 hover:bg-indigo-100 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-indigo-700' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
        >
          <Paperclip size={11} />
          {isAttached ? 'Detach from chat' : 'Attach to chat context'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `components/AIHistoryPage.tsx`**

- Delete the inline `LayerTreeNode` function + `LayerTreeNodeProps` interface (lines ~390–483).
- Delete the inline `LayerPreviewPopup` function + `LayerPreviewPopupProps` interface (lines ~485–542).
- Add to imports:
  ```tsx
  import { LayerTreeNode } from '@/components/ai-history/LayerTreeNode';
  import { LayerPreviewPopup } from '@/components/ai-history/LayerPreviewPopup';
  ```
- Existing call sites compile after the orchestrator state is migrated to multi-attach (Task 10). For now, **comment out the `<LayerTreeNode>` and `<LayerPreviewPopup>` usages in the orchestrator** with a TODO note pointing to Task 10. tsc will succeed because the new imports are typed correctly. Do not delete the call sites — they get rewritten in Task 10.

  In place of the call site, render a placeholder `<div className="p-3 text-xs text-gray-400">Sidebar tree (rebuild in progress)</div>` so the page still loads.

- [ ] **Step 4: Verify type check + build**

```bash
cd /Users/sunil/Development/github/layers
npx tsc --noEmit
```
Expected: exit 0.

```bash
npm run build
```
Expected: "Compiled successfully"

- [ ] **Step 5: Commit**

```bash
git add components/ai-history/LayerTreeNode.tsx components/ai-history/LayerPreviewPopup.tsx components/AIHistoryPage.tsx
git commit -m "refactor(ai-history): extract LayerTreeNode + LayerPreviewPopup"
```

---

## Task 4: Build `LayersSidebar` shell

**Files:**
- Create: `components/ai-history/LayersSidebar.tsx`

**Context:** The new sidebar shell wraps `LayerTreeNode` and adds a header with a collapse toggle. Collapsed state persists in `localStorage[ai_history_sidebar_collapsed]` ('1' | absent). The orchestrator (Task 10) embeds this component in place of the old inline sidebar block.

Do NOT modify the orchestrator in this task. Task 10 wires it.

- [ ] **Step 1: Create `components/ai-history/LayersSidebar.tsx`**

```tsx
'use client';

import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { LayerTreeNode } from '@/components/ai-history/LayerTreeNode';
import type { Layer, LayerMap } from '@/lib/layerStore';

export interface LayersSidebarProps {
  diagramLayers: LayerMap | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  expandedLayerIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onPreview: (id: string, rect: DOMRect) => void;
  attachedLayerIds: string[];
  onAttachToggle: (layer: Layer) => void;
  attachDisabled: (layer: Layer) => boolean;
}

export function LayersSidebar({
  diagramLayers, collapsed, onToggleCollapsed, expandedLayerIds, onToggleExpand,
  onPreview, attachedLayerIds, onAttachToggle, attachDisabled,
}: LayersSidebarProps) {
  if (collapsed) {
    return (
      <div className="flex w-8 flex-shrink-0 flex-col border-r border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900">
        <button
          onClick={onToggleCollapsed}
          title="Show layers"
          className="flex h-9 w-full items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5"
        >
          <ChevronRight size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-52 flex-shrink-0 overflow-hidden border-r border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900">
      <div className="flex h-full flex-col">
        <div className="flex flex-shrink-0 items-center border-b border-gray-200 px-3 py-2.5 dark:border-white/10">
          <Layers size={11} className="mr-1.5 text-indigo-400" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Layers
          </span>
          <button
            onClick={onToggleCollapsed}
            title="Hide layers"
            className="ml-auto rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
          >
            <ChevronLeft size={12} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5">
          {diagramLayers ? (
            Object.values(diagramLayers)
              .filter((l) => l.parentLayerId === null)
              .map((root) => (
                <LayerTreeNode
                  key={root.id}
                  layer={root}
                  layers={diagramLayers}
                  depth={0}
                  expanded={expandedLayerIds}
                  onToggle={onToggleExpand}
                  onPreview={onPreview}
                  attachedLayerIds={attachedLayerIds}
                  onAttachToggle={onAttachToggle}
                  attachDisabled={attachDisabled}
                />
              ))
          ) : (
            <div className="px-3 pt-6">
              <span className="text-xs text-gray-400 dark:text-gray-600">No layers loaded</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify type check + build**

```bash
cd /Users/sunil/Development/github/layers
npx tsc --noEmit
```
Expected: exit 0.

```bash
npm run build
```
Expected: "Compiled successfully"

- [ ] **Step 3: Commit**

```bash
git add components/ai-history/LayersSidebar.tsx
git commit -m "feat(ai-history): add LayersSidebar with collapse toggle"
```

---

## Task 5: Extract `DiagramBubble`

**Files:**
- Create: `components/ai-history/DiagramBubble.tsx`
- Modify: `components/AIHistoryPage.tsx` (delete inline component, add import)

**Context:** Pure extraction with one prop change: the existing inline `DiagramBubble` owns `maximized` state internally and renders its own full-screen overlay. The new component instead delegates maximize to a parent callback (`onMaximize`) that the orchestrator routes into a centralized `<MaximizeOverlay>` (added in Task 7). For this task, the new component takes `onMaximize` and the orchestrator forwards to a no-op stub until Task 7 — this keeps the page compiling.

- [ ] **Step 1: Create `components/ai-history/DiagramBubble.tsx`**

```tsx
'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Maximize2, Zap } from 'lucide-react';
import type { DiagramPayload } from '@/lib/aiHistoryHelpers';

const MiniDiagramPreview = dynamic(() => import('@/components/MiniDiagramPreview'), { ssr: false });

export interface DiagramBubbleProps {
  diagram: DiagramPayload;
  onApply: () => void;
  onMaximize: () => void;
}

export function DiagramBubble({ diagram, onApply, onMaximize }: DiagramBubbleProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2 rounded-xl border border-indigo-200 bg-blue-50/50 dark:border-indigo-800/40 dark:bg-indigo-900/10">
      <div className="flex items-center gap-2 border-b border-indigo-100 px-3 py-2 dark:border-indigo-800/30">
        <Zap size={12} className="text-blue-500" />
        <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
          AI Diagram — {diagram.nodes.length} nodes, {diagram.edges.length} edges
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded px-2 py-0.5 text-[10px] font-medium text-blue-500 transition hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
          >
            {expanded ? 'Hide' : 'Preview'}
          </button>
          {expanded && (
            <button
              onClick={onMaximize}
              title="Expand to full view"
              className="rounded p-1 text-indigo-400 transition hover:bg-indigo-100 hover:text-blue-600 dark:hover:bg-indigo-900/40"
            >
              <Maximize2 size={12} />
            </button>
          )}
          <button
            onClick={onApply}
            className="rounded-lg bg-blue-600 px-2.5 py-0.5 text-[10px] font-medium text-white transition hover:bg-blue-500"
          >
            Copy to canvas
          </button>
        </div>
      </div>
      {expanded && (
        <div className="h-56">
          <MiniDiagramPreview nodes={diagram.nodes} edges={diagram.edges} className="h-full w-full rounded-none border-0" />
        </div>
      )}
    </div>
  );
}
```

The maximized overlay block from the original is dropped — Task 7 centralizes it.

- [ ] **Step 2: Update `components/AIHistoryPage.tsx`**

- Delete the inline `function DiagramBubble` + `DiagramBubbleProps` interface (lines ~544–640 of the post-Task-3 file).
- Add to imports:
  ```tsx
  import { DiagramBubble } from '@/components/ai-history/DiagramBubble';
  ```
- The existing call site `<DiagramBubble diagram={diagramPayload} onApply={() => setApplyTarget(diagramPayload)} />` adds an `onMaximize` prop. Since the maximize overlay isn't wired yet, pass a no-op:
  ```tsx
  <DiagramBubble
    diagram={diagramPayload}
    onApply={() => setApplyTarget(diagramPayload)}
    onMaximize={() => { /* wired in Task 7 */ }}
  />
  ```

- [ ] **Step 3: Verify type check + build**

```bash
cd /Users/sunil/Development/github/layers
npx tsc --noEmit
```
Expected: exit 0.

```bash
npm run build
```
Expected: "Compiled successfully"

- [ ] **Step 4: Commit**

```bash
git add components/ai-history/DiagramBubble.tsx components/AIHistoryPage.tsx
git commit -m "refactor(ai-history): extract DiagramBubble; defer maximize wiring"
```

---

## Task 6: Build `MaximizeOverlay` + centralize maximize state

**Files:**
- Create: `components/ai-history/MaximizeOverlay.tsx`
- Modify: `components/AIHistoryPage.tsx` (add `maximizedDiagram` state, wire callbacks)

**Context:** Centralizes the full-screen `MiniDiagramPreview` overlay. `LayerPreviewPopup` and `DiagramBubble` both dispatch maximize via callbacks; the orchestrator owns a single `maximizedDiagram` state and renders `<MaximizeOverlay>` at top level. This guarantees only one overlay is open at a time.

- [ ] **Step 1: Create `components/ai-history/MaximizeOverlay.tsx`**

```tsx
'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { X } from 'lucide-react';

const MiniDiagramPreview = dynamic(() => import('@/components/MiniDiagramPreview'), { ssr: false });

export interface MaximizedPayload {
  nodes: unknown[];
  edges: unknown[];
  layerName?: string;
}

export interface MaximizeOverlayProps {
  payload: MaximizedPayload | null;
  onClose: () => void;
}

export function MaximizeOverlay({ payload, onClose }: MaximizeOverlayProps) {
  useEffect(() => {
    if (!payload) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [payload, onClose]);

  if (!payload) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative h-[88vh] w-[92vw] overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-gray-200 px-4 py-2.5 dark:border-white/10">
          <span className="text-sm font-semibold text-gray-800 dark:text-white">
            {payload.layerName ?? 'Diagram preview'}
          </span>
          <span className="ml-2 text-xs text-gray-400">
            {payload.nodes.length} nodes · {payload.edges.length} edges
          </span>
          <button
            onClick={onClose}
            aria-label="Close maximized preview"
            className="ml-auto rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
          >
            <X size={14} />
          </button>
        </div>
        <div className="h-[calc(100%-44px)]">
          <MiniDiagramPreview nodes={payload.nodes} edges={payload.edges} className="h-full w-full rounded-none border-0" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `components/AIHistoryPage.tsx`**

- Add to imports:
  ```tsx
  import { MaximizeOverlay, type MaximizedPayload } from '@/components/ai-history/MaximizeOverlay';
  ```
- Add state near the other top-level state hooks:
  ```tsx
  const [maximizedDiagram, setMaximizedDiagram] = useState<MaximizedPayload | null>(null);
  ```
- Wire the `DiagramBubble` `onMaximize` to use the maximize state:
  ```tsx
  <DiagramBubble
    diagram={diagramPayload}
    onApply={() => setApplyTarget(diagramPayload)}
    onMaximize={() => setMaximizedDiagram({
      nodes: diagramPayload.nodes,
      edges: diagramPayload.edges,
      layerName: msg.layerName ?? undefined,
    })}
  />
  ```
- Render the overlay at top level inside the page wrapper, just before the closing `</div>`:
  ```tsx
  <MaximizeOverlay payload={maximizedDiagram} onClose={() => setMaximizedDiagram(null)} />
  ```

(`LayerPreviewPopup`'s `onMaximize` is also wired by passing `setMaximizedDiagram({ nodes: layer.nodes, edges: layer.edges, layerName: layer.name })` — but since the popup call site is the placeholder from Task 3, defer that wiring to Task 10 when the call sites are reinstated.)

- [ ] **Step 3: Verify type check + build**

```bash
cd /Users/sunil/Development/github/layers
npx tsc --noEmit
```
Expected: exit 0.

```bash
npm run build
```
Expected: "Compiled successfully"

- [ ] **Step 4: Commit**

```bash
git add components/ai-history/MaximizeOverlay.tsx components/AIHistoryPage.tsx
git commit -m "feat(ai-history): centralize MaximizeOverlay with shared diagram state"
```

---

## Task 7: Extract `ChatMessage`

**Files:**
- Create: `components/ai-history/ChatMessage.tsx`

**Context:** Carve out the user/assistant bubble rendering from the orchestrator's `uiItems.map(...)` block (around lines 1070–1238). One component renders a single `{ kind: 'message', data: ChatMessage }` item. Keeps per-message metadata chips (model + token counts) per the spec. Multi-attach support: when more than one attached layer was active at send time, renders extra badges from a new `extraLayerNames?: string[]` prop (this is for visual display only — backend schema only persists one).

Do NOT modify the orchestrator in this task; Task 10 wires it.

- [ ] **Step 1: Create `components/ai-history/ChatMessage.tsx`**

```tsx
'use client';

import { Layers, Sparkles, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { mdComponents } from '@/lib/markdownRenderers';
import { formatChatTime, splitDiagramContent, type DiagramPayload } from '@/lib/aiHistoryHelpers';
import type { ChatMessage as ChatMessageType } from '@/lib/api';
import { DiagramBubble } from '@/components/ai-history/DiagramBubble';

export interface ChatMessageProps {
  msg: ChatMessageType;
  /** Streaming buffer used in lieu of msg.content while the assistant is mid-response. */
  streamingContent?: string;
  /** Additional layer names tagged at send time (multi-attach). May be empty/undefined. */
  extraLayerNames?: string[];
  onApplyDiagram: (diagram: DiagramPayload) => void;
  onMaximizeDiagram: (diagram: DiagramPayload, layerName?: string) => void;
}

export function ChatMessage({
  msg, streamingContent, extraLayerNames, onApplyDiagram, onMaximizeDiagram,
}: ChatMessageProps) {
  const isUser = msg.role === 'user';
  const raw = streamingContent ?? msg.content;
  const { text: displayText, diagram: diagramPayload } = splitDiagramContent(raw);

  if (isUser) {
    return (
      <div className="flex items-start justify-end gap-3">
        <div className="max-w-[85%] min-w-0">
          <div className="rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-sm text-white">
            {msg.content}
          </div>
          <div className="mt-1 text-right text-[10px] text-gray-400 dark:text-blue-300/40">
            {formatChatTime(msg.createdAt)}
          </div>
        </div>
        <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 ring-1 ring-indigo-200 dark:bg-blue-500/30 dark:ring-indigo-400/30">
          <User size={13} className="text-blue-600 dark:text-indigo-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100 ring-1 ring-indigo-200 dark:bg-blue-500/30 dark:ring-indigo-400/40">
        <Sparkles size={12} className="text-blue-500 dark:text-blue-300" />
      </div>
      <div className="max-w-[85%] min-w-0">
        {(msg.layerName || (extraLayerNames && extraLayerNames.length > 0)) && (
          <div className="mb-1 flex flex-wrap gap-1">
            {msg.layerName && (
              <span className="flex items-center gap-1 rounded-full border border-blue-300/30 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-500 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300/60">
                <Layers size={8} /> {msg.layerName}
              </span>
            )}
            {extraLayerNames?.map((name) => (
              <span
                key={name}
                className="flex items-center gap-1 rounded-full border border-blue-300/30 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-500 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300/60"
              >
                <Layers size={8} /> {name}
              </span>
            ))}
          </div>
        )}
        <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-2.5 text-gray-700 ring-1 ring-gray-200 dark:bg-white/[0.06] dark:text-indigo-100/90 dark:ring-white/10">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {displayText}
          </ReactMarkdown>
          {diagramPayload && (
            <DiagramBubble
              diagram={diagramPayload}
              onApply={() => onApplyDiagram(diagramPayload)}
              onMaximize={() => onMaximizeDiagram(diagramPayload, msg.layerName ?? undefined)}
            />
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-gray-400 dark:text-blue-300/40">
            {formatChatTime(msg.createdAt)}
          </span>
          {msg.model && (
            <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-blue-300/50">
              {msg.provider ? `${msg.provider}/` : ''}{msg.model}
            </span>
          )}
          {(msg.inputTokens || msg.outputTokens) && (
            <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-blue-300/40">
              {msg.inputTokens ? `↑${msg.inputTokens}` : ''}
              {msg.inputTokens && msg.outputTokens ? ' ' : ''}
              {msg.outputTokens ? `↓${msg.outputTokens}` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify type check + build**

```bash
cd /Users/sunil/Development/github/layers
npx tsc --noEmit
```
Expected: exit 0.

```bash
npm run build
```
Expected: "Compiled successfully"

- [ ] **Step 3: Commit**

```bash
git add components/ai-history/ChatMessage.tsx
git commit -m "feat(ai-history): add ChatMessage component with multi-layer badges"
```

---

## Task 8: Build `ChatComposer` with multi-attach (cap 3)

**Files:**
- Create: `components/ai-history/ChatComposer.tsx`

**Context:** Composer with a multi-attach chip row (cap 3) above a textarea. Owns nothing but the textarea ref; all state lives in the orchestrator. The orchestrator passes the attached array, the cap, the send handler, and the input value/setter.

- [ ] **Step 1: Create `components/ai-history/ChatComposer.tsx`**

```tsx
'use client';

import { Layers, Loader2, Paperclip, Send, X } from 'lucide-react';
import { type KeyboardEvent, type RefObject } from 'react';
import type { Layer } from '@/lib/layerStore';

export interface ChatComposerProps {
  textareaRef: RefObject<HTMLTextAreaElement>;
  input: string;
  onInputChange: (next: string) => void;
  attachedLayers: Layer[];
  onDetachLayer: (layerId: string) => void;
  onSend: () => void;
  isStreaming: boolean;
  isLoading: boolean;
  /** Maximum attached count (currently 3). Used only for the placeholder hint. */
  attachCap: number;
}

export function ChatComposer({
  textareaRef, input, onInputChange, attachedLayers, onDetachLayer, onSend,
  isStreaming, isLoading, attachCap,
}: ChatComposerProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const placeholder =
    attachedLayers.length > 0
      ? `Ask about or request changes to "${attachedLayers.map((l) => l.name).join(', ')}"…`
      : 'Send a message… (Enter to send, Shift+Enter for newline)';

  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-white dark:border-white/10 dark:bg-gray-950">
      {attachedLayers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2 dark:border-white/5">
          <Paperclip size={11} className="flex-shrink-0 text-indigo-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Context:</span>
          {attachedLayers.map((layer) => (
            <span
              key={layer.id}
              className="flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-indigo-900/40 dark:text-blue-300"
            >
              <Layers size={10} />
              {layer.name}
              <span className="text-[9px] text-indigo-400">({layer.nodes.length})</span>
              <button
                onClick={() => onDetachLayer(layer.id)}
                aria-label={`Detach ${layer.name}`}
                className="ml-0.5 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {attachedLayers.length}/{attachCap}
          </span>
        </div>
      )}

      <div className="mx-auto flex max-w-4xl items-end gap-3 p-4">
        <textarea
          ref={textareaRef}
          rows={2}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming || isLoading}
          placeholder={placeholder}
          className="flex-1 resize-none rounded-xl bg-gray-100 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none ring-1 ring-gray-300 transition focus:ring-blue-400/70 disabled:opacity-50 dark:bg-white/[0.06] dark:text-white dark:placeholder-indigo-300/40 dark:ring-white/15 dark:focus:ring-blue-400/50"
        />
        <button
          onClick={onSend}
          disabled={!input.trim() || isStreaming || isLoading}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify type check + build**

```bash
cd /Users/sunil/Development/github/layers
npx tsc --noEmit
```
Expected: exit 0.

```bash
npm run build
```
Expected: "Compiled successfully"

- [ ] **Step 3: Commit**

```bash
git add components/ai-history/ChatComposer.tsx
git commit -m "feat(ai-history): add ChatComposer with multi-attach chip row"
```

---

## Task 9: Build `ApplyDiagramDrawer`

**Files:**
- Create: `components/ai-history/ApplyDiagramDrawer.tsx`

**Context:** Right-docked drawer (`w-96`) replacing the modal. One screen with a target radio, optional node-link picker, and a confirm button. Spec §4 has the exact layout.

The drawer takes the `onApply` callback that the orchestrator's `handleApplyDiagram` is wired to. The orchestrator already has `handleApplyDiagram(opts)` from the existing modal — keep that signature unchanged.

- [ ] **Step 1: Create `components/ai-history/ApplyDiagramDrawer.tsx`**

```tsx
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import type { Layer, LayerMap } from '@/lib/layerStore';
import type { DiagramPayload } from '@/lib/aiHistoryHelpers';
import { LINE_NODE_TYPES } from '@/lib/nodeConfig';

const MiniDiagramPreview = dynamic(() => import('@/components/MiniDiagramPreview'), { ssr: false });

export interface LinkableShape {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  layerId: string;
  layerName: string;
}

export interface ApplyOptions {
  mode: 'override' | 'new';
  targetLayerId?: string;
  newLayerName?: string;
  linkToNode?: LinkableShape;
}

export interface ApplyDiagramDrawerProps {
  diagram: DiagramPayload;
  attachedLayers: Layer[];
  allLayers: LayerMap;
  onApply: (opts: ApplyOptions) => Promise<void> | void;
  onClose: () => void;
}

export function ApplyDiagramDrawer({
  diagram, attachedLayers, allLayers, onApply, onClose,
}: ApplyDiagramDrawerProps) {
  const defaultLayer = attachedLayers[0] ?? Object.values(allLayers).find((l) => l.parentLayerId === null);
  const [mode, setMode] = useState<'override' | 'new'>(defaultLayer ? 'override' : 'new');
  const [targetLayerId, setTargetLayerId] = useState<string | null>(defaultLayer?.id ?? null);
  const [newLayerName, setNewLayerName] = useState(
    defaultLayer ? `${defaultLayer.name} (AI Enhanced)` : 'AI Generated Layer',
  );
  const [linkToNodeId, setLinkToNodeId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Esc to close (only when not applying)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !applying) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, applying]);

  // Pickable node list — non-line nodes from the parent (currently attached) layer.
  const linkableShapes = useMemo<LinkableShape[]>(() => {
    const parent = attachedLayers[0];
    if (!parent) return [];
    return parent.nodes
      .filter((n) => !LINE_NODE_TYPES.includes(n.type as never))
      .map((n) => ({
        nodeId: n.id,
        nodeLabel: (n.data as { label?: string } | undefined)?.label ?? n.id,
        nodeType: n.type ?? 'node',
        layerId: parent.id,
        layerName: parent.name,
      }));
  }, [attachedLayers]);

  const layerOptions = useMemo(() => Object.values(allLayers), [allLayers]);

  const valid =
    (mode === 'override' && !!targetLayerId) ||
    (mode === 'new' && newLayerName.trim().length > 0);

  const handleConfirm = async () => {
    if (!valid || applying) return;
    setApplying(true);
    setError(null);
    try {
      await onApply({
        mode,
        targetLayerId: mode === 'override' ? (targetLayerId ?? undefined) : undefined,
        newLayerName: mode === 'new' ? newLayerName.trim() : undefined,
        linkToNode: mode === 'new' && linkToNodeId
          ? linkableShapes.find((s) => s.nodeId === linkToNodeId)
          : undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-96 flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div className="min-w-0 flex-1 pr-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Apply diagram</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {diagram.nodes.length} nodes · {diagram.edges.length} edges
          </p>
        </div>
        <button
          onClick={onClose}
          disabled={applying}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Preview */}
        <section className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Preview</h3>
          <div className="h-40 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <MiniDiagramPreview nodes={diagram.nodes} edges={diagram.edges} className="h-full w-full rounded-none border-0" />
          </div>
        </section>

        {/* Target */}
        <section className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Target</h3>

          <label className="mb-2 flex items-start gap-2 text-sm">
            <input
              type="radio"
              checked={mode === 'override'}
              onChange={() => setMode('override')}
              className="mt-1"
              disabled={applying}
            />
            <div className="flex-1">
              <span className="text-slate-700 dark:text-slate-200">Override existing layer</span>
              <select
                value={targetLayerId ?? ''}
                onChange={(e) => setTargetLayerId(e.target.value || null)}
                disabled={mode !== 'override' || applying}
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="">Select a layer…</option>
                {layerOptions.map((l) => (
                  <option key={l.id} value={l.id}>{l.name || 'Untitled'}</option>
                ))}
              </select>
            </div>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              checked={mode === 'new'}
              onChange={() => setMode('new')}
              className="mt-1"
              disabled={applying}
            />
            <div className="flex-1">
              <span className="text-slate-700 dark:text-slate-200">Create new layer</span>
              <input
                type="text"
                value={newLayerName}
                onChange={(e) => setNewLayerName(e.target.value)}
                disabled={mode !== 'new' || applying}
                maxLength={64}
                placeholder="Layer name"
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </label>
        </section>

        {/* Link to node — only when creating new */}
        {mode === 'new' && linkableShapes.length > 0 && (
          <section className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Link to node (optional)
            </h3>
            <select
              value={linkToNodeId ?? ''}
              onChange={(e) => setLinkToNodeId(e.target.value || null)}
              disabled={applying}
              className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="">None — standalone layer</option>
              {linkableShapes.map((s) => (
                <option key={s.nodeId} value={s.nodeId}>
                  {s.nodeLabel} ({s.nodeType})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              The new layer is attached as a drill-down child of the picked node.
            </p>
          </section>
        )}

        {/* Notes */}
        <section className="px-5 py-4">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Override replaces the layer's nodes/edges. Linking attaches the new layer as a child of the picked node (drill-down).
          </p>
        </section>

        {/* Error */}
        {error && (
          <section className="px-5 pb-3">
            <div className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/10 dark:text-red-400">
              <AlertCircle size={12} />
              {error}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
        <button
          onClick={onClose}
          disabled={applying}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!valid || applying}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {applying ? <Loader2 size={11} className="animate-spin" /> : null}
          Apply diagram
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify type check + build**

```bash
cd /Users/sunil/Development/github/layers
npx tsc --noEmit
```
Expected: exit 0.

```bash
npm run build
```
Expected: "Compiled successfully"

- [ ] **Step 3: Commit**

```bash
git add components/ai-history/ApplyDiagramDrawer.tsx
git commit -m "feat(ai-history): add ApplyDiagramDrawer replacing modal"
```

---

## Task 10: Rebuild `AIHistoryPage` orchestrator

**Files:**
- Modify (rewrite): `components/AIHistoryPage.tsx`

**Context:** The orchestrator. After Tasks 1–9 the file still has the old single-attach state (`attachedLayer`), the inline filter / send handlers, and the placeholder div from Task 3 in place of the sidebar. This task wires everything: multi-attach state (cap 3), `LayersSidebar` with `sidebarCollapsed` + localStorage, `ChatMessage` rendering, `ChatComposer`, `ApplyDiagramDrawer` replacing `ApplyDiagramModal`, `MaximizeOverlay` already in place from Task 6.

The existing `handleApplyDiagram(opts)` and `handleSend` keep their signatures.

- [ ] **Step 1: Replace the sidebar placeholder + state**

In `components/AIHistoryPage.tsx`, replace:

```tsx
const [attachedLayer, setAttachedLayer] = useState<Layer | null>(null);
```

with:

```tsx
const ATTACH_CAP = 3;
const [attachedLayers, setAttachedLayers] = useState<Layer[]>([]);

const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem('ai_history_sidebar_collapsed') === '1';
});

const handleToggleSidebar = useCallback(() => {
  setSidebarCollapsed((prev) => {
    const next = !prev;
    try { window.localStorage.setItem('ai_history_sidebar_collapsed', next ? '1' : '0'); } catch {}
    return next;
  });
}, []);

const handleAttachToggle = useCallback((layer: Layer) => {
  setAttachedLayers((prev) => {
    if (prev.some((l) => l.id === layer.id)) {
      return prev.filter((l) => l.id !== layer.id);
    }
    if (prev.length >= ATTACH_CAP) return prev;
    return [...prev, layer];
  });
}, []);

const handleDetachLayer = useCallback((layerId: string) => {
  setAttachedLayers((prev) => prev.filter((l) => l.id !== layerId));
}, []);

const attachDisabled = useCallback(
  (layer: Layer) => !attachedLayers.some((l) => l.id === layer.id) && attachedLayers.length >= ATTACH_CAP,
  [attachedLayers],
);
```

Update every existing reference:
- `attachedLayer?.id` → `attachedLayers[0]?.id` for the persisted `layerId` field on assistant messages.
- `attachedLayer?.name` → `attachedLayers[0]?.name` for the persisted `layerName` field.
- `setAttachedLayer(layer)` → `handleAttachToggle(layer)`.
- `setAttachedLayer(null)` → `setAttachedLayers([])` for the "New conversation" reset.

Update the prompt-prefix logic in `handleSend` so that when `attachedLayers.length > 0`, the message body is prefixed with `Layers in scope: <names joined by ", ">\n\n` before passing to `apiContextualChatAsk`. Visible-bubble user message keeps the original input (don't store the prefixed version).

- [ ] **Step 2: Replace the sidebar placeholder + popup**

Replace the placeholder `<div>` from Task 3 and the now-removed inline `LayerPreviewPopup` block with:

```tsx
<LayersSidebar
  diagramLayers={diagramLayers}
  collapsed={sidebarCollapsed}
  onToggleCollapsed={handleToggleSidebar}
  expandedLayerIds={expandedLayers}
  onToggleExpand={handleToggleExpand}
  onPreview={handlePreview}
  attachedLayerIds={attachedLayers.map((l) => l.id)}
  onAttachToggle={handleAttachToggle}
  attachDisabled={attachDisabled}
/>

{previewLayer && previewAnchorRect && (
  <LayerPreviewPopup
    layer={previewLayer}
    anchorRect={previewAnchorRect}
    isAttached={attachedLayers.some((l) => l.id === previewLayer.id)}
    onAttach={() => handleAttachToggle(previewLayer)}
    onClose={() => setPreviewLayerId(null)}
    onMaximize={() => setMaximizedDiagram({
      nodes: previewLayer.nodes,
      edges: previewLayer.edges,
      layerName: previewLayer.name,
    })}
  />
)}
```

Add to imports:

```tsx
import { LayersSidebar } from '@/components/ai-history/LayersSidebar';
```

- [ ] **Step 3: Replace inline message rendering with `<ChatMessage>`**

Inside the `uiItems.map((item, i) => …)` loop, replace the inline user/assistant bubble rendering (the entire `if (item.kind === 'message')` and `if (item.kind === 'streaming')` JSX blocks) with:

```tsx
if (item.kind === 'message') {
  const msg = item.data;
  // Find the next message-kind index (or use current i) — extra layer names
  // is empty for now since we don't persist multi-layer set on the backend.
  return (
    <ChatMessage
      key={`m-${i}-${msg.id}`}
      msg={msg}
      onApplyDiagram={(d) => setApplyTarget(d)}
      onMaximizeDiagram={(d, layerName) => setMaximizedDiagram({
        nodes: d.nodes,
        edges: d.edges,
        layerName,
      })}
    />
  );
}
if (item.kind === 'streaming') {
  // Synthesize a placeholder ChatMessage shape for the streaming bubble.
  const fakeMsg: ChatMessage = {
    id: `streaming-${i}`,
    projectId,
    role: 'assistant',
    content: '', // streaming buffer is passed via streamingContent
    layerId: attachedLayers[0]?.id ?? null,
    layerName: attachedLayers[0]?.name ?? null,
    diagramData: null,
    createdAt: new Date().toISOString(),
  } as ChatMessage;
  return (
    <ChatMessage
      key={`s-${i}`}
      msg={fakeMsg}
      streamingContent={item.content}
      extraLayerNames={attachedLayers.slice(1).map((l) => l.name)}
      onApplyDiagram={(d) => setApplyTarget(d)}
      onMaximizeDiagram={(d, layerName) => setMaximizedDiagram({
        nodes: d.nodes,
        edges: d.edges,
        layerName,
      })}
    />
  );
}
// posture_score / attack_mind branches preserved as-is from the existing monolith
```

The `posture_score` and `attack_mind` UI item branches stay inline (out of scope for this redesign). Do not refactor them.

Add to imports:

```tsx
import { ChatMessage as ChatMessageComponent } from '@/components/ai-history/ChatMessage';
```

(Avoid the local-name collision with the `ChatMessage` API type by aliasing on import.)

- [ ] **Step 4: Replace inline composer with `<ChatComposer>`**

Replace the entire `<div className="flex-shrink-0 border-t …">` composer block with:

```tsx
<ChatComposer
  textareaRef={textareaRef}
  input={input}
  onInputChange={setInput}
  attachedLayers={attachedLayers}
  onDetachLayer={handleDetachLayer}
  onSend={() => void handleSend()}
  isStreaming={isStreaming}
  isLoading={isLoading}
  attachCap={ATTACH_CAP}
/>
```

Add to imports:

```tsx
import { ChatComposer } from '@/components/ai-history/ChatComposer';
```

- [ ] **Step 5: Replace `ApplyDiagramModal` with `ApplyDiagramDrawer`**

Delete the inline `function ApplyDiagramModal(...)` block and its `ApplyModalProps` / `LinkableShape` interfaces (lines ~192–390 of the post-Task-3 file). Replace the `{applyTarget && diagramLayers && <ApplyDiagramModal …>}` block with:

```tsx
{applyTarget && diagramLayers && (
  <ApplyDiagramDrawer
    diagram={applyTarget}
    attachedLayers={attachedLayers}
    allLayers={diagramLayers}
    onApply={handleApplyDiagram}
    onClose={() => setApplyTarget(null)}
  />
)}
```

Add to imports:

```tsx
import { ApplyDiagramDrawer } from '@/components/ai-history/ApplyDiagramDrawer';
```

`handleApplyDiagram(opts)` keeps its existing signature.

- [ ] **Step 6: Verify type check**

```bash
cd /Users/sunil/Development/github/layers
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 7: Verify build**

```bash
npm run build
```
Expected: "Compiled successfully"

- [ ] **Step 8: Manual smoke**

Start the dev server (`npm run dev`), log in, open `/projects/<id>/ai-history`. Verify:
- Top bar (Layers logo, Back to diagram, project name, message count, New conversation, theme cycle, user)
- Layers sidebar default-expanded; click chevron in header → collapses to a 32px rail; refresh → collapsed state persists; expand again → tree state preserved
- Click Eye on a layer → preview popup appears; click Maximize in the popup header → full-screen overlay; Esc closes
- Click Paperclip on three layers → all three appear as chips in composer; Paperclip on a fourth layer is disabled with "Up to 3 layers" tooltip
- Click X on a chip → chip disappears
- Send a message with two layers attached → user bubble has only the typed text; assistant bubble shows two layer badges
- Click "Preview" on a `DiagramBubble` → inline mini diagram appears; click Maximize → full-screen overlay; Esc closes
- Click "Copy to canvas" on a `DiagramBubble` → drawer opens (right-docked); pick override layer, then click Apply → drawer closes; canvas updates back at `/projects/:id`
- Click "New conversation" → separator appears; attached layers cleared
- Light + dark mode look correct on every surface

- [ ] **Step 9: Commit**

```bash
git add components/AIHistoryPage.tsx
git commit -m "feat(ai-history): rebuild orchestrator with sidebar collapse + multi-attach + drawer"
```

---

## Final verification

After Task 10 lands:

- [ ] **Branch type check + build clean**

```bash
npx tsc --noEmit
npm run build
```

Both must pass.

- [ ] **Push branch + open PR to main**

```bash
git push -u origin feat/ai-history-redesign
gh pr create --title "feat: ai history redesign" --body "$(cat <<'EOF'
## Summary
- Replace 1300-line AIHistoryPage monolith with focused per-component files under components/ai-history/
- Collapsible Layers sidebar with persisted preference (localStorage[ai_history_sidebar_collapsed])
- Multi-attach (cap 3) layer context with chip row + cap-disabled Paperclip
- Right-docked ApplyDiagramDrawer replaces the modal
- Centralized MaximizeOverlay for full-screen MiniDiagramPreview (one slot)
- Per-message metadata chips (model + token counts) kept
- Helpers extracted: lib/aiHistoryHelpers.ts + lib/markdownRenderers.ts

## Test plan
- [ ] Manual smoke on /projects/:id/ai-history covering sidebar collapse, multi-attach (1/2/3), Eye preview maximize, DiagramBubble maximize, drawer apply (override and new layer + node link), New conversation, light + dark mode
- [ ] Refresh persists sidebar collapse state
- [ ] beforeunload still blocks navigation while streaming

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of scope (deferred)

- Branching conversations (fork from a message)
- Message search / filter
- Persist attached-layer state across page reloads
- Per-message regenerate
- Export chat as markdown
- Migrating `mitigationMdComponents` from the threat detail page to `lib/markdownRenderers.ts`
- Tests — no test infrastructure in this repo today
