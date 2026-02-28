'use client';

import type { Edge } from 'reactflow';
import { X, Trash2 } from 'lucide-react';
import { EDGE_MARKER, EDGE_MARKER_START } from '@/lib/diagramUtils';

const COLOR_SWATCHES = [
  { value: '#64748b', label: 'Slate (default)' },
  { value: '#1e293b', label: 'Dark' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#22c55e', label: 'Green' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#f97316', label: 'Orange' },
  { value: '#ef4444', label: 'Red' },
  { value: '#a855f7', label: 'Purple' },
];

type ArrowDir = 'forward' | 'backward' | 'both' | 'none';

function getDirection(edge: Edge): ArrowDir {
  const hasEnd = !!edge.markerEnd;
  const hasStart = !!edge.markerStart;
  if (hasEnd && hasStart) return 'both';
  if (hasEnd) return 'forward';
  if (hasStart) return 'backward';
  return 'none';
}

function dirToMarkers(dir: ArrowDir): Partial<Edge> {
  const colorHint = '#64748b'; // will be overridden by current color below
  switch (dir) {
    case 'forward':
      return { markerEnd: EDGE_MARKER, markerStart: undefined };
    case 'backward':
      return { markerStart: { ...EDGE_MARKER_START, color: colorHint }, markerEnd: undefined };
    case 'both':
      return {
        markerEnd: EDGE_MARKER,
        markerStart: EDGE_MARKER_START,
      };
    case 'none':
      return { markerEnd: undefined, markerStart: undefined };
  }
}

interface EdgePropertiesPanelProps {
  edge: Edge;
  onClose: () => void;
  onUpdate: (edgeId: string, updates: Partial<Edge>) => void;
  onDelete: (edgeId: string) => void;
}

export default function EdgePropertiesPanel({
  edge,
  onClose,
  onUpdate,
  onDelete,
}: EdgePropertiesPanelProps) {
  const currentColor = (edge.style as { stroke?: string } | undefined)?.stroke ?? '#64748b';
  const currentDir = getDirection(edge);
  const label = typeof edge.label === 'string' ? edge.label : '';

  const updateColor = (color: string) => {
    onUpdate(edge.id, {
      style: { ...(edge.style as object), stroke: color, strokeWidth: 2 },
      // Keep marker color in sync — spread from base to preserve required `type` field
      markerEnd: edge.markerEnd ? { ...EDGE_MARKER, color } : undefined,
      markerStart: edge.markerStart ? { ...EDGE_MARKER_START, color } : undefined,
    });
  };

  const updateDir = (dir: ArrowDir) => {
    const markers = dirToMarkers(dir);
    // Apply current color to new markers — spread from base to preserve required `type` field
    onUpdate(edge.id, {
      ...markers,
      markerEnd: markers.markerEnd ? { ...EDGE_MARKER, color: currentColor } : undefined,
      markerStart: markers.markerStart ? { ...EDGE_MARKER_START, color: currentColor } : undefined,
    });
  };

  const ARROW_OPTS: { dir: ArrowDir; label: string; title: string }[] = [
    { dir: 'forward', label: 'A → B', title: 'Single arrow (forward)' },
    { dir: 'backward', label: 'A ← B', title: 'Single arrow (backward)' },
    { dir: 'both', label: 'A ↔ B', title: 'Double arrow (bidirectional)' },
    { dir: 'none', label: 'A — B', title: 'No arrow' },
  ];

  return (
    <aside className="flex h-full w-64 flex-col border-l border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Edge Properties</h2>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Label */}
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Label
          </label>
          <input
            type="text"
            value={label}
            placeholder="e.g. HTTP, TCP, Data flow"
            onChange={(e) => onUpdate(edge.id, { label: e.target.value || undefined })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-blue-900/30"
          />
        </div>

        {/* Arrow direction */}
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Direction
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {ARROW_OPTS.map(({ dir, label: btnLabel, title }) => (
              <button
                key={dir}
                title={title}
                onClick={() => updateDir(dir)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                  currentDir === dir
                    ? 'border-blue-400 bg-blue-50 text-blue-700 ring-1 ring-blue-300 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-700'
                }`}
              >
                {btnLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Color
          </label>
          <div className="flex flex-wrap gap-1.5">
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch.value}
                title={swatch.label}
                onClick={() => updateColor(swatch.value)}
                className={`h-5 w-5 flex-shrink-0 rounded-full border transition-all hover:scale-110 ${
                  currentColor === swatch.value
                    ? 'border-blue-500 ring-2 ring-blue-300 ring-offset-1'
                    : 'border-slate-300 hover:border-slate-400'
                }`}
                style={{ backgroundColor: swatch.value }}
              />
            ))}
          </div>
        </div>

        {/* Edge ID */}
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Edge ID
          </label>
          <p className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
            {edge.id}
          </p>
        </div>
      </div>

      <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
        <button
          onClick={() => { onDelete(edge.id); onClose(); }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
        >
          <Trash2 size={14} />
          Delete edge
        </button>
      </div>
    </aside>
  );
}
