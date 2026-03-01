'use client';

import { Layers } from 'lucide-react';
import type { ProjectDiff, DiffStatus, LayerDiff } from '@/lib/diffEngine';

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_DOT: Record<DiffStatus, string> = {
  added: 'bg-green-500',
  removed: 'bg-red-500',
  modified: 'bg-amber-500',
  unchanged: 'bg-slate-300 dark:bg-slate-600',
};

const STATUS_ROW: Record<DiffStatus, string> = {
  added: 'bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30',
  removed: 'bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30',
  modified: 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30',
  unchanged: 'hover:bg-slate-50 dark:hover:bg-slate-800',
};

const STATUS_LABEL: Record<DiffStatus, string> = {
  added: 'text-green-700 dark:text-green-400',
  removed: 'text-red-700 dark:text-red-400',
  modified: 'text-amber-700 dark:text-amber-400',
  unchanged: 'text-slate-500 dark:text-slate-400',
};

// ─── Layer row ────────────────────────────────────────────────────────────────

function LayerRow({
  layerDiff,
  active,
  onClick,
}: {
  layerDiff: LayerDiff;
  active: boolean;
  onClick: () => void;
}) {
  const displayName =
    layerDiff.status === 'added'
      ? layerDiff.rightName
      : layerDiff.leftName;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${STATUS_ROW[layerDiff.status]} ${
        active ? 'ring-1 ring-inset ring-blue-400 dark:ring-blue-500' : ''
      }`}
    >
      {/* Status dot */}
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[layerDiff.status]}`} />

      {/* Layer info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Layers size={11} className="flex-shrink-0 text-slate-400 dark:text-slate-500" />
          <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{displayName}</span>
          {layerDiff.status !== 'unchanged' && (
            <span className={`flex-shrink-0 text-[10px] font-semibold ${STATUS_LABEL[layerDiff.status]}`}>
              {layerDiff.status === 'added' ? 'added' : layerDiff.status === 'removed' ? 'removed' : 'changed'}
            </span>
          )}
        </div>

        {/* Change counts */}
        {layerDiff.counts.total > 0 && (
          <div className="mt-0.5 flex items-center gap-2 pl-4">
            {layerDiff.counts.added > 0 && (
              <span className="text-[9px] font-medium text-green-600 dark:text-green-400">+{layerDiff.counts.added}</span>
            )}
            {layerDiff.counts.removed > 0 && (
              <span className="text-[9px] font-medium text-red-600 dark:text-red-400">−{layerDiff.counts.removed}</span>
            )}
            {layerDiff.counts.modified > 0 && (
              <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400">~{layerDiff.counts.modified}</span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── DiffLayersPanel ──────────────────────────────────────────────────────────

interface DiffLayersPanelProps {
  diff: ProjectDiff;
  activeLayerId: string | null;
  onSelectLayer: (layerId: string) => void;
}

export default function DiffLayersPanel({ diff, activeLayerId, onSelectLayer }: DiffLayersPanelProps) {
  const { counts } = diff;

  return (
    <div className="flex h-full w-56 flex-shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <Layers size={14} className="text-slate-500 dark:text-slate-400" />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Layers</span>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
        {counts.added > 0 && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400">
            +{counts.added} layer{counts.added !== 1 ? 's' : ''}
          </span>
        )}
        {counts.removed > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-400">
            −{counts.removed} layer{counts.removed !== 1 ? 's' : ''}
          </span>
        )}
        {counts.modified > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            ~{counts.modified} changed
          </span>
        )}
        {counts.total === 0 && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">No layer differences</span>
        )}
      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto">
        {diff.layers.map((layerDiff) => (
          <LayerRow
            key={layerDiff.layerId}
            layerDiff={layerDiff}
            active={activeLayerId === layerDiff.layerId}
            onClick={() => onSelectLayer(layerDiff.layerId)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="border-t border-slate-100 px-3 py-2 dark:border-slate-800">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Legend</div>
        <div className="flex flex-col gap-0.5">
          {(
            [
              ['added', 'Added', 'text-green-700 dark:text-green-400'],
              ['removed', 'Removed', 'text-red-700 dark:text-red-400'],
              ['modified', 'Modified', 'text-amber-700 dark:text-amber-400'],
              ['unchanged', 'Unchanged', 'text-slate-500 dark:text-slate-400'],
            ] as const
          ).map(([status, label, textCls]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
              <span className={`text-[9px] ${textCls}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
