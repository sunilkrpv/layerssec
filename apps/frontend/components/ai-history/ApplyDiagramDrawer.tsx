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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !applying) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, applying]);

  const linkableShapes = useMemo<LinkableShape[]>(() => {
    const parent = attachedLayers[0];
    if (!parent) return [];
    return parent.nodes
      .filter((n) => !LINE_NODE_TYPES.has(n.type ?? ''))
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

      <div className="flex-1 overflow-y-auto">
        <section className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Preview</h3>
          <div className="h-40 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <MiniDiagramPreview nodes={diagram.nodes} edges={diagram.edges} className="h-full w-full rounded-none border-0" />
          </div>
        </section>

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

        <section className="px-5 py-4">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Override replaces the layer&apos;s nodes/edges. Linking attaches the new layer as a child of the picked node (drill-down).
          </p>
        </section>

        {error && (
          <section className="px-5 pb-3">
            <div className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/10 dark:text-red-400">
              <AlertCircle size={12} />
              {error}
            </div>
          </section>
        )}
      </div>

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
