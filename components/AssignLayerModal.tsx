'use client';

import { Link, X } from 'lucide-react';
import type { Layer } from '@/lib/layerStore';

interface AssignLayerModalProps {
  /** Label of the shape being assigned to */
  shapeLabel: string;
  /** Available unattached layers */
  orphanedLayers: Layer[];
  onConfirm: (layerId: string) => void;
  onCancel: () => void;
}

export default function AssignLayerModal({
  shapeLabel,
  orphanedLayers,
  onConfirm,
  onCancel,
}: AssignLayerModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link size={18} className="text-blue-600" />
            <h2 className="text-base font-semibold text-slate-800">Assign Layer</h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-500">
          Link an existing layer to{' '}
          <span className="font-medium text-slate-700">&ldquo;{shapeLabel}&rdquo;</span>:
        </p>

        {/* Layer list */}
        {orphanedLayers.length === 0 ? (
          <p className="rounded-lg bg-slate-50 py-6 text-center text-sm text-slate-400">
            No unattached layers available.
          </p>
        ) : (
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {orphanedLayers.map((layer) => (
              <button
                key={layer.id}
                onClick={() => onConfirm(layer.id)}
                className="flex w-full items-start gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">{layer.name}</p>
                  {layer.description && (
                    <p className="truncate text-xs text-slate-400">{layer.description}</p>
                  )}
                  <p className="text-xs text-slate-400">
                    {layer.nodes.length} node{layer.nodes.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onCancel}
          className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
