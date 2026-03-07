'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeft, Check, ChevronRight, Copy, Eye, Layers, Loader2,
  Maximize2, MessageSquare, Minimize2, Paperclip, PlusCircle, Send, Sparkles, SquarePen,
  User, X, Zap, AlertTriangle, GitBranch,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  apiContextualChatAsk, apiGetChatHistory, apiGetProject, apiGetProjectDraft,
  apiUpdateDiagram, ApiUnauthorizedError, type ChatMessage,
} from '@/lib/api';
import { ROOT_LAYER_ID, type Layer, type LayerMap } from '@/lib/layerStore';
import { LINE_NODE_TYPES } from '@/lib/nodeConfig';

const MiniDiagramPreview = dynamic(() => import('./MiniDiagramPreview'), { ssr: false });

// ── Types ────────────────────────────────────────────────────────────────────

type UIItem =
  | { kind: 'message'; data: ChatMessage }
  | { kind: 'streaming'; content: string }
  | { kind: 'separator' };

interface DiagramPayload {
  nodes: unknown[];
  edges: unknown[];
}

// ── CopyableCodeBlock ────────────────────────────────────────────────────────

function CopyableCodeBlock({ children }: { children?: React.ReactNode }) {
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

// ── Markdown components ──────────────────────────────────────────────────────

const mdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 text-sm leading-relaxed last:mb-0">{children}</p>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-2 mt-3 text-base font-bold text-gray-900 dark:text-white">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-1.5 mt-3 text-sm font-bold text-gray-900 dark:text-white">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-1 mt-2 text-sm font-semibold text-gray-700 dark:text-indigo-100">{children}</h3>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-indigo-600 dark:text-indigo-200">{children}</em>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 ml-4 list-disc space-y-0.5 text-sm">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-0.5 text-sm">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isBlock = /language-/.test(className ?? '');
    return isBlock ? (
      <code className={`font-mono text-xs text-gray-100 ${className ?? ''}`}>{children}</code>
    ) : (
      <code className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-xs text-slate-700 dark:bg-indigo-800/60 dark:text-blue-200">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <CopyableCodeBlock>{children}</CopyableCodeBlock>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

const DIAGRAM_SEP = '---DIAGRAM---';

/** Split streamed/stored text into display text + optional diagram JSON.
 *  Handles both the ---DIAGRAM--- separator protocol and fallback markdown code blocks. */
function splitDiagramContent(raw: string): { text: string; diagram: DiagramPayload | null } {
  // Primary: ---DIAGRAM--- separator
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

  // Fallback: last ```json ... ``` code block that contains nodes + edges
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

// ── ThinkingDots ─────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <span className="flex items-center gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-indigo-400"
          style={{ animation: 'thinking-dot 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
        />
      ))}
      <style>{`@keyframes thinking-dot{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}`}</style>
    </span>
  );
}

// ── ApplyDiagramModal ─────────────────────────────────────────────────────────

interface LinkableShape {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  layerId: string;
  layerName: string;
}

interface ApplyModalProps {
  diagram: DiagramPayload;
  /** The layer currently attached to chat — may be null if none attached */
  attachedLayer: Layer | null;
  allLayers: LayerMap;
  onApply: (opts: {
    mode: 'override' | 'new';
    targetLayerId?: string;      // for override
    newLayerName?: string;       // for new
    linkToNode?: LinkableShape;  // for new + link
  }) => void;
  onClose: () => void;
}

function ApplyDiagramModal({ diagram, attachedLayer, allLayers, onApply, onClose }: ApplyModalProps) {
  const [mode, setMode] = useState<'override' | 'new'>(attachedLayer ? 'override' : 'new');
  const [newLayerName, setNewLayerName] = useState(
    attachedLayer ? `${attachedLayer.name} (AI Enhanced)` : 'AI Generated Layer'
  );
  // Step 2 — link to shape
  const [step, setStep] = useState<'choose' | 'link'>('choose');
  const [selectedShape, setSelectedShape] = useState<LinkableShape | null>(null);

  // Collect all non-line nodes across all layers for the link step
  const linkableShapes: LinkableShape[] = Object.values(allLayers).flatMap((layer) =>
    layer.nodes
      .filter((n: { type?: string }) => !LINE_NODE_TYPES.has(n.type ?? ''))
      .map((n: { id: string; type?: string; data?: { label?: string } }) => ({
        nodeId: n.id,
        nodeLabel: (n.data as { label?: string } | undefined)?.label ?? n.id,
        nodeType: n.type ?? 'service',
        layerId: layer.id,
        layerName: layer.name,
      }))
  );

  function handleChooseNext() {
    if (mode === 'override') {
      if (!attachedLayer) return;
      onApply({ mode: 'override', targetLayerId: attachedLayer.id });
    } else {
      if (!newLayerName.trim()) return;
      setStep('link');
    }
  }

  function handleLinkConfirm() {
    onApply({ mode: 'new', newLayerName: newLayerName.trim(), linkToNode: selectedShape ?? undefined });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-white/10">

        {/* ── Step 1: Choose mode ─────────────────────────────────────────── */}
        {step === 'choose' && (
          <>
            <div className="border-b border-gray-100 px-5 py-4 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-indigo-500" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Apply AI Diagram</h2>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {diagram.nodes.length} nodes · {diagram.edges.length} edges
              </p>
            </div>

            <div className="space-y-3 p-5">
              {/* Override existing — only shown when a layer is attached */}
              {attachedLayer ? (
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${mode === 'override' ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-500/50 dark:bg-indigo-900/20' : 'border-gray-200 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5'}`}>
                  <input type="radio" className="mt-0.5 accent-indigo-600" checked={mode === 'override'} onChange={() => setMode('override')} />
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-white">
                      <AlertTriangle size={13} className="text-amber-500" />
                      Override &ldquo;{attachedLayer.name}&rdquo;
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      Replaces the layer&apos;s nodes and edges. Cannot be undone from this view.
                    </p>
                  </div>
                </label>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-600/30 dark:bg-amber-900/20 dark:text-amber-400">
                  No layer attached — you can only create a new layer. Attach a layer from the sidebar to enable override.
                </div>
              )}

              {/* Create new layer */}
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${mode === 'new' ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-500/50 dark:bg-indigo-900/20' : 'border-gray-200 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5'}`}>
                <input type="radio" className="mt-0.5 accent-indigo-600" checked={mode === 'new'} onChange={() => setMode('new')} />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-white">
                    <GitBranch size={13} className="text-green-500" />
                    Create new standalone layer
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    Creates a new layer and lets you link it to an existing shape.
                  </p>
                  {mode === 'new' && (
                    <input
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 outline-none focus:ring-1 focus:ring-indigo-400 dark:border-white/20 dark:bg-white/10 dark:text-white"
                      value={newLayerName}
                      onChange={(e) => setNewLayerName(e.target.value)}
                      placeholder="New layer name"
                      autoFocus
                    />
                  )}
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-white/10">
              <button onClick={onClose} className="rounded-lg px-4 py-1.5 text-sm text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10">
                Cancel
              </button>
              <button
                onClick={handleChooseNext}
                disabled={mode === 'new' && !newLayerName.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
              >
                {mode === 'override' ? 'Apply & Override' : 'Next: Link to Shape →'}
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Link new layer to a shape ───────────────────────────── */}
        {step === 'link' && (
          <>
            <div className="border-b border-gray-100 px-5 py-4 dark:border-white/10">
              <div className="flex items-center gap-2">
                <GitBranch size={15} className="text-green-500" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Link to a Shape (optional)</h2>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Pick a shape to drill into this new layer, or skip to leave it standalone.
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto p-3">
              {linkableShapes.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-400 dark:text-gray-600">No shapes available to link.</p>
              ) : (
                <div className="space-y-1">
                  {linkableShapes.map((shape) => (
                    <button
                      key={`${shape.layerId}-${shape.nodeId}`}
                      onClick={() => setSelectedShape((prev) => prev?.nodeId === shape.nodeId ? null : shape)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${selectedShape?.nodeId === shape.nodeId ? 'bg-indigo-50 ring-1 ring-indigo-300 dark:bg-indigo-900/30 dark:ring-indigo-600' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                    >
                      <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${selectedShape?.nodeId === shape.nodeId ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300 dark:border-white/20'}`}>
                        {selectedShape?.nodeId === shape.nodeId && <Check size={10} className="text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-gray-800 dark:text-white">{shape.nodeLabel}</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">{shape.layerName} · {shape.nodeType}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between gap-2 border-t border-gray-100 px-5 py-4 dark:border-white/10">
              <button onClick={() => setStep('choose')} className="rounded-lg px-4 py-1.5 text-sm text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10">
                ← Back
              </button>
              <div className="flex gap-2">
                <button onClick={() => onApply({ mode: 'new', newLayerName: newLayerName.trim() })} className="rounded-lg px-4 py-1.5 text-sm text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10">
                  Skip (no link)
                </button>
                <button
                  onClick={handleLinkConfirm}
                  disabled={!selectedShape}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
                >
                  Create &amp; Link
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Layer tree ────────────────────────────────────────────────────────────────

interface LayerTreeNodeProps {
  layer: Layer;
  layers: LayerMap;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onPreview: (id: string, rect: DOMRect) => void;
  attachedLayerId: string | null;
  onAttach: (layer: Layer) => void;
}

function LayerTreeNode({
  layer, layers, depth, expanded, onToggle, onPreview, attachedLayerId, onAttach,
}: LayerTreeNodeProps) {
  const children = Object.values(layers).filter((l) => l.parentLayerId === layer.id);
  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(layer.id);
  const isAttached = attachedLayerId === layer.id;
  const rowRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div
        ref={rowRef}
        className={`group flex cursor-pointer items-center gap-1 rounded-lg py-1 pr-1 text-xs transition ${isAttached ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'}`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        title={layer.name}
      >
        {/* Expand/collapse chevron */}
        <button
          className="flex-shrink-0 rounded p-0.5 hover:bg-gray-200 dark:hover:bg-white/10"
          onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggle(layer.id); }}
        >
          <ChevronRight
            size={11}
            className={`transition-transform text-gray-400 ${hasChildren ? '' : 'opacity-0'} ${isExpanded ? 'rotate-90' : ''}`}
          />
        </button>

        {/* Layer icon + name */}
        <Layers size={11} className="flex-shrink-0 text-indigo-400 dark:text-indigo-500" />
        <span className="min-w-0 flex-1 truncate font-medium">{layer.name || 'Untitled'}</span>

        {/* Node count */}
        {layer.nodes.length > 0 && (
          <span className="flex-shrink-0 rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] text-gray-500 dark:bg-white/10 dark:text-gray-400">
            {layer.nodes.length}
          </span>
        )}

        {/* Action buttons — visible on hover */}
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
            onClick={(e) => {
              e.stopPropagation();
              onAttach(isAttached ? ({ id: '' } as Layer) : layer);
            }}
            title={isAttached ? 'Detach from chat' : 'Attach to chat'}
            className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-white/10"
          >
            <Paperclip size={10} className={isAttached ? 'text-indigo-500' : 'text-gray-400'} />
          </button>
        </div>
      </div>

      {/* Children */}
      {isExpanded && children.map((child) => (
        <LayerTreeNode
          key={child.id}
          layer={child}
          layers={layers}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          onPreview={onPreview}
          attachedLayerId={attachedLayerId}
          onAttach={onAttach}
        />
      ))}
    </>
  );
}

// ── LayerPreviewPopup ─────────────────────────────────────────────────────────

interface LayerPreviewPopupProps {
  layer: Layer;
  anchorRect: DOMRect;
  isAttached: boolean;
  onAttach: () => void;
  onClose: () => void;
}

function LayerPreviewPopup({ layer, anchorRect, isAttached, onAttach, onClose }: LayerPreviewPopupProps) {
  // Position to the right of the sidebar anchor row
  const style: React.CSSProperties = {
    position: 'fixed',
    left: anchorRect.right + 8,
    top: Math.min(anchorRect.top, window.innerHeight - 340),
    width: 320,
    zIndex: 60,
  };

  return (
    <div style={style} className="rounded-2xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5 dark:border-white/10 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 dark:border-white/10">
        <Layers size={13} className="flex-shrink-0 text-indigo-400" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800 dark:text-white">
          {layer.name}
        </span>
        <span className="text-[10px] text-gray-400">{layer.nodes.length} nodes</span>
        <button onClick={onClose} className="ml-1 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10">
          <X size={12} />
        </button>
      </div>

      {/* Mini React Flow */}
      <div className="h-48 overflow-hidden">
        {layer.nodes.length > 0 ? (
          <MiniDiagramPreview nodes={layer.nodes} edges={layer.edges} className="h-full w-full rounded-none border-0" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-400 dark:text-gray-600">
            Empty layer
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-3 py-2 dark:border-white/10">
        <button
          onClick={onAttach}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${isAttached ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:ring-indigo-700' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
        >
          <Paperclip size={11} />
          {isAttached ? 'Detach from chat' : 'Attach to chat context'}
        </button>
      </div>
    </div>
  );
}

// ── DiagramBubble ─────────────────────────────────────────────────────────────

interface DiagramBubbleProps {
  diagram: DiagramPayload;
  onApply: () => void;
}

function DiagramBubble({ diagram, onApply }: DiagramBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const [maximized, setMaximized] = useState(false);
  return (
    <>
      <div className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50/50 dark:border-indigo-800/40 dark:bg-indigo-900/10">
        <div className="flex items-center gap-2 border-b border-indigo-100 px-3 py-2 dark:border-indigo-800/30">
          <Zap size={12} className="text-indigo-500" />
          <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400">
            AI Diagram — {diagram.nodes.length} nodes, {diagram.edges.length} edges
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="rounded px-2 py-0.5 text-[10px] font-medium text-indigo-500 transition hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
            >
              {expanded ? 'Hide' : 'Preview'}
            </button>
            {expanded && (
              <button
                onClick={() => setMaximized(true)}
                title="Expand to full view"
                className="rounded p-1 text-indigo-400 transition hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-900/40"
              >
                <Maximize2 size={12} />
              </button>
            )}
            <button
              onClick={onApply}
              className="rounded-lg bg-indigo-600 px-2.5 py-0.5 text-[10px] font-medium text-white transition hover:bg-indigo-500"
            >
              Apply →
            </button>
          </div>
        </div>
        {expanded && (
          <div className="h-56">
            <MiniDiagramPreview nodes={diagram.nodes} edges={diagram.edges} className="h-full w-full rounded-none border-0" />
          </div>
        )}
      </div>

      {/* Maximized overlay — fills the AI History viewport */}
      {maximized && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-950">
          {/* Header */}
          <div
            className="flex flex-shrink-0 items-center gap-3 px-4 py-3"
            style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #1e3a8a 100%)' }}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                <Zap size={13} className="text-blue-300" />
              </div>
              <span className="text-sm font-semibold text-white">
                AI Diagram — {diagram.nodes.length} nodes, {diagram.edges.length} edges
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={onApply}
                className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-400"
              >
                Apply →
              </button>
              <button
                onClick={() => setMaximized(false)}
                title="Close"
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-indigo-200/70 transition hover:bg-white/10 hover:text-white"
              >
                <Minimize2 size={14} />
                Close
              </button>
            </div>
          </div>
          {/* Full canvas */}
          <div className="flex-1 overflow-hidden">
            <MiniDiagramPreview nodes={diagram.nodes} edges={diagram.edges} className="h-full w-full rounded-none border-0" />
          </div>
        </div>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AIHistoryPageProps { projectId: string }

export default function AIHistoryPage({ projectId }: AIHistoryPageProps) {
  const router = useRouter();

  // ── Core chat state ──────────────────────────────────────────────────────
  const [uiItems, setUiItems] = useState<UIItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingRef = useRef('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Project / layers ─────────────────────────────────────────────────────
  const [projectName, setProjectName] = useState<string | null>(null);
  const [diagramLayers, setDiagramLayers] = useState<LayerMap | null>(null);
  const [diagramId, setDiagramId] = useState<string | null>(null);

  // ── Layer sidebar UI ─────────────────────────────────────────────────────
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set([ROOT_LAYER_ID]));
  const [previewLayerId, setPreviewLayerId] = useState<string | null>(null);
  const [previewAnchorRect, setPreviewAnchorRect] = useState<DOMRect | null>(null);

  // ── Attached layer (persists for entire session) ─────────────────────────
  const [attachedLayer, setAttachedLayer] = useState<Layer | null>(null);

  // ── Apply diagram modal ──────────────────────────────────────────────────
  const [applyTarget, setApplyTarget] = useState<DiagramPayload | null>(null);

  const messageCount = uiItems.filter((i) => i.kind === 'message').length;

  // ── Load on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    const historyP = apiGetChatHistory(projectId)
      .then((msgs) => {
        setUiItems(msgs.map((m) => ({ kind: 'message', data: m })));
        setIsLoading(false);
      })
      .catch((err) => {
        if (err instanceof ApiUnauthorizedError) { router.push('/projects'); return; }
        setError('Failed to load chat history.');
        setIsLoading(false);
      });

    const projectP = apiGetProject(projectId)
      .then((p) => setProjectName(p.name))
      .catch(() => {});

    const layersP = apiGetProjectDraft(projectId)
      .then((draft) => {
        if (!draft) return;
        setDiagramId(draft.id);
        const data = draft.canvasData as { layers?: LayerMap } | null;
        if (data?.layers && typeof data.layers === 'object') {
          setDiagramLayers(data.layers);
          setExpandedLayers(new Set([ROOT_LAYER_ID]));
        }
      })
      .catch(() => {});

    void Promise.all([historyP, projectP, layersP]);
  }, [projectId, router]);

  // ── Scroll to bottom ─────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [uiItems]);

  // ── Prevent navigation while streaming ───────────────────────────────────
  useEffect(() => {
    if (!isStreaming) return;
    const fn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, [isStreaming]);

  // ── Layer sidebar helpers ─────────────────────────────────────────────────
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedLayers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handlePreview = useCallback((id: string, rect: DOMRect) => {
    setPreviewLayerId((prev) => (prev === id ? null : id));
    setPreviewAnchorRect(rect);
  }, []);

  const handleAttach = useCallback((layer: Layer) => {
    setAttachedLayer((prev) => (prev?.id === layer.id ? null : layer));
    setPreviewLayerId(null);
  }, []);

  // ── Chat history builder ─────────────────────────────────────────────────
  function buildHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    let start = 0;
    for (let i = uiItems.length - 1; i >= 0; i--) {
      if (uiItems[i].kind === 'separator') { start = i + 1; break; }
    }
    return uiItems
      .slice(start)
      .filter((item): item is { kind: 'message'; data: ChatMessage } => item.kind === 'message')
      .slice(-20)
      .map((item) => ({ role: item.data.role, content: item.data.content }));
  }

  // ── Send message ──────────────────────────────────────────────────────────
  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');

    const history = buildHistory();
    const fakeUserMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      projectId,
      role: 'user',
      content: text,
      layerId: attachedLayer?.id ?? null,
      layerName: attachedLayer?.name ?? null,
      createdAt: new Date().toISOString(),
    };

    setUiItems((prev) => [
      ...prev,
      { kind: 'message', data: fakeUserMsg },
      { kind: 'streaming', content: '' },
    ]);
    setIsStreaming(true);
    streamingRef.current = '';

    try {
      await apiContextualChatAsk(
        { message: text, projectId, diagramId: diagramId ?? undefined, history },
        (chunk) => {
          streamingRef.current += chunk;
          const accumulated = streamingRef.current;
          setUiItems((prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            if (next[lastIdx]?.kind === 'streaming') {
              next[lastIdx] = { kind: 'streaming', content: accumulated };
            }
            return next;
          });
        },
      );

      // Parse diagram from full response
      const { text: textContent, diagram } = splitDiagramContent(streamingRef.current);

      const assistantMsg: ChatMessage = {
        id: `local-assistant-${Date.now()}`,
        projectId,
        role: 'assistant',
        content: textContent,
        layerId: attachedLayer?.id ?? null,
        layerName: attachedLayer?.name ?? null,
        diagramData: diagram,
        createdAt: new Date().toISOString(),
      };

      setUiItems((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (next[lastIdx]?.kind === 'streaming') {
          next[lastIdx] = { kind: 'message', data: assistantMsg };
        }
        return next;
      });
    } catch {
      setUiItems((prev) => prev.filter((i) => i.kind !== 'streaming'));
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  }

  function handleNewConversation() {
    setUiItems((prev) => [...prev, { kind: 'separator' }]);
    textareaRef.current?.focus();
  }

  // ── Apply diagram to layer ────────────────────────────────────────────────
  async function handleApplyDiagram(opts: {
    mode: 'override' | 'new';
    targetLayerId?: string;
    newLayerName?: string;
    linkToNode?: LinkableShape;
  }) {
    if (!applyTarget || !diagramLayers || !diagramId) return;
    setApplyTarget(null);

    const updatedLayers = { ...diagramLayers };

    if (opts.mode === 'new') {
      const newId = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      updatedLayers[newId] = {
        id: newId,
        name: opts.newLayerName ?? 'AI Generated Layer',
        parentLayerId: ROOT_LAYER_ID,
        parentNodeId: null,
        nodes: applyTarget.nodes as import('reactflow').Node[],
        edges: applyTarget.edges as import('reactflow').Edge[],
        createdAt: Date.now(),
      };
      // Link new layer to chosen shape by setting _childLayerId on that node
      if (opts.linkToNode) {
        const { nodeId, layerId } = opts.linkToNode;
        const targetLayer = updatedLayers[layerId];
        if (targetLayer) {
          updatedLayers[layerId] = {
            ...targetLayer,
            nodes: targetLayer.nodes.map((n: import('reactflow').Node) =>
              n.id === nodeId
                ? { ...n, data: { ...n.data, _childLayerId: newId } }
                : n
            ),
          };
        }
      }
    } else {
      // Override existing layer nodes/edges
      const targetLayerId = opts.targetLayerId;
      if (!targetLayerId) return;
      const existing = updatedLayers[targetLayerId];
      if (!existing) return;
      updatedLayers[targetLayerId] = {
        ...existing,
        nodes: applyTarget.nodes as import('reactflow').Node[],
        edges: applyTarget.edges as import('reactflow').Edge[],
      };
    }

    setDiagramLayers(updatedLayers);

    // Persist to backend
    try {
      const canvasData = { layers: updatedLayers, navStack: [ROOT_LAYER_ID] };
      await apiUpdateDiagram(diagramId, canvasData);
    } catch {
      // non-critical — user can still go back to diagram and save manually
    }
  }

  // ── Layer preview popup layer ─────────────────────────────────────────────
  const previewLayer = previewLayerId && diagramLayers ? diagramLayers[previewLayerId] : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-gray-950">

      {/* Top bar */}
      <div
        className="relative z-10 flex flex-shrink-0 items-center gap-3 px-4 py-3"
        style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #1e3a8a 100%)' }}
      >
        <button
          onClick={() => !isStreaming && router.push(`/projects/${projectId}`)}
          disabled={isStreaming}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-indigo-200/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft size={15} />
          Back to diagram
        </button>

        <div className="h-4 w-px bg-white/15" />

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
            <Sparkles size={13} className="text-blue-300" />
          </div>
          <span className="text-sm font-semibold text-white">{projectName ?? 'AI History'}</span>
        </div>

        <span className="ml-auto text-xs text-indigo-300/50">
          {messageCount} message{messageCount !== 1 ? 's' : ''}
        </span>

        <button
          onClick={handleNewConversation}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-indigo-200/70 transition hover:bg-white/10 hover:text-white"
        >
          <SquarePen size={13} />
          New
        </button>
      </div>

      {/* Body: sidebar + chat */}
      <div className="flex flex-1 overflow-hidden">

        {/* Layers sidebar */}
        <div className="relative w-52 flex-shrink-0 overflow-hidden border-r border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900">
          {diagramLayers ? (
            <div className="flex h-full flex-col">
              <div className="flex-shrink-0 border-b border-gray-200 px-3 py-2.5 dark:border-white/10">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Layers
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-1.5">
                {Object.values(diagramLayers)
                  .filter((l) => l.parentLayerId === null)
                  .map((root) => (
                    <LayerTreeNode
                      key={root.id}
                      layer={root}
                      layers={diagramLayers}
                      depth={0}
                      expanded={expandedLayers}
                      onToggle={handleToggleExpand}
                      onPreview={handlePreview}
                      attachedLayerId={attachedLayer?.id ?? null}
                      onAttach={handleAttach}
                    />
                  ))}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-start px-3 pt-8">
              <span className="text-xs text-gray-400 dark:text-gray-600">No layers loaded</span>
            </div>
          )}
        </div>

        {/* Layer preview popup */}
        {previewLayer && previewAnchorRect && (
          <LayerPreviewPopup
            layer={previewLayer}
            anchorRect={previewAnchorRect}
            isAttached={attachedLayer?.id === previewLayer.id}
            onAttach={() => handleAttach(previewLayer)}
            onClose={() => setPreviewLayerId(null)}
          />
        )}

        {/* Chat column */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Message list */}
          <div className="flex-1 overflow-y-auto bg-white px-4 py-4 dark:bg-gray-950">
            {isLoading && (
              <div className="flex items-center justify-center py-20 text-sm text-gray-400 dark:text-indigo-300/60">
                Loading history…
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center py-20 text-sm text-red-500 dark:text-red-400">{error}</div>
            )}
            {!isLoading && !error && uiItems.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 ring-1 ring-gray-200 dark:bg-white/10 dark:ring-white/20">
                  <MessageSquare size={24} className="text-gray-400 dark:text-indigo-300/60" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-indigo-200/70">No AI conversations yet</p>
                <p className="max-w-xs text-xs text-gray-400 dark:text-indigo-300/40">
                  Attach a layer from the sidebar, then ask a question or request changes.
                </p>
              </div>
            )}

            {!isLoading && !error && uiItems.length > 0 && (
              <div className="mx-auto max-w-4xl space-y-4">
                {uiItems.map((item, i) => {
                  if (item.kind === 'separator') {
                    return (
                      <div key={`sep-${i}`} className="flex items-center gap-3 py-3">
                        <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-gray-400 dark:text-indigo-300/40">
                          <PlusCircle size={10} /> New conversation
                        </span>
                        <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                      </div>
                    );
                  }

                  if (item.kind === 'streaming') {
                    const { text: displayText } = splitDiagramContent(item.content);
                    return (
                      <div key={`streaming-${i}`} className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100 ring-1 ring-indigo-200 dark:bg-indigo-500/30 dark:ring-indigo-400/40">
                          <Sparkles size={12} className="text-indigo-500 dark:text-blue-300" />
                        </div>
                        <div className="max-w-[85%] min-w-0">
                          <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-2.5 text-gray-700 ring-1 ring-gray-200 dark:bg-white/[0.06] dark:text-indigo-100/90 dark:ring-white/10">
                            {item.content === '' ? (
                              <ThinkingDots />
                            ) : (
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                                {displayText || item.content}
                              </ReactMarkdown>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const msg = item.data;
                  const prevMsg = (() => {
                    for (let j = i - 1; j >= 0; j--) {
                      if (uiItems[j].kind === 'message') return (uiItems[j] as { kind: 'message'; data: ChatMessage }).data;
                    }
                    return null;
                  })();
                  const showDateSep = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);

                  // For stored messages, split diagram from content
                  const { text: displayText, diagram: msgDiagram } = splitDiagramContent(msg.content);
                  const diagramPayload = (msg.diagramData as DiagramPayload | null | undefined) ?? msgDiagram;

                  return (
                    <div key={msg.id}>
                      {showDateSep && (
                        <div className="flex items-center gap-3 py-2">
                          <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                          <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400 dark:text-indigo-300/40">
                            {formatDate(msg.createdAt)}
                          </span>
                          <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                        </div>
                      )}

                      {msg.role === 'user' ? (
                        <div className="flex items-start justify-end gap-3">
                          <div className="max-w-[80%]">
                            {msg.layerName && (
                              <div className="mb-1 flex justify-end">
                                <span className="flex items-center gap-1 rounded-full border border-blue-300/30 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-500 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300/60">
                                  <Paperclip size={8} /> {msg.layerName}
                                </span>
                              </div>
                            )}
                            <div className="rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 text-sm text-white">
                              {msg.content}
                            </div>
                            <div className="mt-1 text-right text-[10px] text-gray-400 dark:text-indigo-300/40">
                              {formatTime(msg.createdAt)}
                            </div>
                          </div>
                          <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 ring-1 ring-indigo-200 dark:bg-indigo-500/30 dark:ring-indigo-400/30">
                            <User size={13} className="text-indigo-600 dark:text-indigo-200" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100 ring-1 ring-indigo-200 dark:bg-indigo-500/30 dark:ring-indigo-400/40">
                            <Sparkles size={12} className="text-indigo-500 dark:text-blue-300" />
                          </div>
                          <div className="max-w-[85%] min-w-0">
                            {msg.layerName && (
                              <div className="mb-1">
                                <span className="flex items-center gap-1 rounded-full border border-blue-300/30 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-500 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300/60">
                                  <Layers size={8} /> {msg.layerName}
                                </span>
                              </div>
                            )}
                            <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-2.5 text-gray-700 ring-1 ring-gray-200 dark:bg-white/[0.06] dark:text-indigo-100/90 dark:ring-white/10">
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                                {displayText}
                              </ReactMarkdown>
                              {diagramPayload && (
                                <DiagramBubble
                                  diagram={diagramPayload}
                                  onApply={() => setApplyTarget(diagramPayload)}
                                />
                              )}
                            </div>
                            <div className="mt-1 text-[10px] text-gray-400 dark:text-indigo-300/40">
                              {formatTime(msg.createdAt)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input footer */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-white dark:border-white/10 dark:bg-gray-950">
            {/* Attached layer chip */}
            {attachedLayer && (
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2 dark:border-white/5">
                <Paperclip size={11} className="flex-shrink-0 text-indigo-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Context:</span>
                <span className="flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  <Layers size={10} />
                  {attachedLayer.name}
                  <span className="text-[9px] text-indigo-400">({attachedLayer.nodes.length} nodes)</span>
                </span>
                <button
                  onClick={() => setAttachedLayer(null)}
                  className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="mx-auto flex max-w-4xl items-end gap-3 p-4">
              <textarea
                ref={textareaRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isStreaming || isLoading}
                placeholder={attachedLayer ? `Ask about or request changes to "${attachedLayer.name}"…` : 'Send a message… (Enter to send, Shift+Enter for newline)'}
                className="flex-1 resize-none rounded-xl bg-gray-100 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none ring-1 ring-gray-300 transition focus:ring-indigo-400/70 disabled:opacity-50 dark:bg-white/[0.06] dark:text-white dark:placeholder-indigo-300/40 dark:ring-white/15 dark:focus:ring-indigo-400/50"
              />
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || isStreaming || isLoading}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>{/* end chat column */}
      </div>{/* end body row */}

      {/* Apply diagram modal */}
      {applyTarget && diagramLayers && (
        <ApplyDiagramModal
          diagram={applyTarget}
          attachedLayer={attachedLayer}
          allLayers={diagramLayers}
          onApply={handleApplyDiagram}
          onClose={() => setApplyTarget(null)}
        />
      )}
    </div>
  );
}
