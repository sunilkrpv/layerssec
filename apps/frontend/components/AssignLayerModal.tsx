'use client';

import { useState } from 'react';
import { Link, X, Layers, ArrowRightLeft } from 'lucide-react';

export interface AssignableLayer {
  id: string;
  name: string;
  description?: string;
  nodeCount: number;
  /** If set, this layer is currently owned by another shape (its label). */
  currentOwnerLabel?: string;
}

interface AssignLayerModalProps {
  /** Label of the shape being assigned to */
  shapeLabel: string;
  /** All layers that can be assigned — orphaned or currently owned by a sibling shape */
  availableLayers: AssignableLayer[];
  onConfirm: (layerId: string) => void;
  onCancel: () => void;
}

export default function AssignLayerModal({
  shapeLabel,
  availableLayers,
  onConfirm,
  onCancel,
}: AssignLayerModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = availableLayers.find((l) => l.id === selectedId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
        {/* Header */}
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link size={18} className="text-blue-600" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Assign Layer</h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Select a layer to link to{' '}
          <span className="font-medium text-slate-700 dark:text-slate-200">&ldquo;{shapeLabel}&rdquo;</span>:
        </p>

        {/* Layer list */}
        {availableLayers.length === 0 ? (
          <p className="rounded-lg bg-slate-50 py-6 text-center text-sm text-slate-400 dark:bg-slate-700 dark:text-slate-500">
            No available layers to assign.
          </p>
        ) : (
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {availableLayers.map((layer) => {
              const isSelected = layer.id === selectedId;
              return (
                <button
                  key={layer.id}
                  onClick={() => setSelectedId(layer.id)}
                  className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30'
                      : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-600 dark:hover:border-blue-600 dark:hover:bg-blue-900/20'
                  }`}
                >
                  <Layers size={14} className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{layer.name}</p>
                    {layer.currentOwnerLabel ? (
                      <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <ArrowRightLeft size={10} />
                        Currently on &ldquo;{layer.currentOwnerLabel}&rdquo;
                      </p>
                    ) : layer.description ? (
                      <p className="truncate text-xs text-slate-400 dark:text-slate-500">{layer.description}</p>
                    ) : null}
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {layer.nodeCount} node{layer.nodeCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Confirmation note when reassigning from another shape */}
        {selected?.currentOwnerLabel && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
            This will remove &ldquo;{selected.name}&rdquo; from &ldquo;{selected.currentOwnerLabel}&rdquo; and assign it here.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            disabled={!selectedId}
            onClick={() => selectedId && onConfirm(selectedId)}
            className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Assign Layer
          </button>
        </div>
      </div>
    </div>
  );
}
