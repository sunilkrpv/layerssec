'use client';

import { useState } from 'react';
import { ArrowRightLeft, X } from 'lucide-react';
import type { Node } from 'reactflow';
import type { NodeData, NodeType } from '@/lib/types';
import { PALETTE_ITEMS } from '@/lib/nodeConfig';

interface ReassignLayerModalProps {
  /** Name of the layer being reassigned */
  layerName: string;
  /** Shapes in the current layer that can receive the layer */
  targetCandidates: Node<NodeData>[];
  onConfirm: (targetNodeId: string) => void;
  onCancel: () => void;
}

export default function ReassignLayerModal({
  layerName,
  targetCandidates,
  onConfirm,
  onCancel,
}: ReassignLayerModalProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
        {/* Header */}
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-blue-600" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Reassign Layer</h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Move{' '}
          <span className="font-medium text-slate-700 dark:text-slate-200">&ldquo;{layerName}&rdquo;</span>{' '}
          to a different shape:
        </p>

        {/* Candidate list */}
        {targetCandidates.length === 0 ? (
          <p className="rounded-lg bg-slate-50 py-6 text-center text-sm text-slate-400 dark:bg-slate-700 dark:text-slate-500">
            No other shapes available — all shapes in this layer already have their own child layer.
          </p>
        ) : (
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {targetCandidates.map((node) => {
              const palette = PALETTE_ITEMS.find((item) => item.type === (node.type as NodeType));
              const Icon = palette?.icon;
              const isSelected = node.id === selectedNodeId;
              return (
                <button
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    isSelected
                      ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30'
                      : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-600 dark:hover:border-blue-600 dark:hover:bg-blue-900/20'
                  }`}
                >
                  {Icon && (
                    <Icon size={15} className={palette?.color ?? 'text-slate-500'} />
                  )}
                  <span className="flex-1 font-medium text-slate-700 dark:text-slate-200">
                    {node.data.label || '(unlabelled)'}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{node.type}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            disabled={!selectedNodeId}
            onClick={() => selectedNodeId && onConfirm(selectedNodeId)}
            className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reassign Layer
          </button>
        </div>
      </div>
    </div>
  );
}
