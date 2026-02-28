'use client';

import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteLayerModalProps {
  layerName: string;
  /** Number of additional descendant layers that will also be deleted */
  descendantCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteLayerModal({
  layerName,
  descendantCount,
  onConfirm,
  onCancel,
}: DeleteLayerModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 size={18} className="text-red-500" />
            <h2 className="text-base font-semibold text-slate-800">Delete Layer</h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <p className="text-sm text-slate-600">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-800">&ldquo;{layerName}&rdquo;</span>?
        </p>

        {descendantCount > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-amber-500" />
            <p className="text-xs text-amber-800">
              This will also permanently delete{' '}
              <span className="font-semibold">{descendantCount}</span> nested child{' '}
              {descendantCount === 1 ? 'layer' : 'layers'}.
            </p>
          </div>
        )}

        <p className="mt-2 text-xs text-slate-400">This action cannot be undone.</p>

        {/* Actions */}
        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Delete Layer
          </button>
        </div>
      </div>
    </div>
  );
}
