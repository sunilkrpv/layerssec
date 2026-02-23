'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Layers, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import { ROOT_LAYER_ID, type Layer, type LayerMap } from '@/lib/layerStore';

interface LayersPanelProps {
  layers: LayerMap;
  currentLayerId: string;
  onClose: () => void;
  onNavigate: (layerId: string) => void;
  onUpdateLayer: (layerId: string, updates: { name?: string; description?: string }) => void;
}

/** Build an ordered list of layers with depth for tree display */
function buildTree(layers: LayerMap): Array<{ layer: Layer; depth: number }> {
  const result: Array<{ layer: Layer; depth: number }> = [];

  function visit(layerId: string, depth: number) {
    const layer = layers[layerId];
    if (!layer) return;
    result.push({ layer, depth });
    // Find direct children, sorted by creation time
    const children = Object.values(layers)
      .filter((l) => l.parentLayerId === layerId)
      .sort((a, b) => a.createdAt - b.createdAt);
    for (const child of children) {
      visit(child.id, depth + 1);
    }
  }

  visit(ROOT_LAYER_ID, 0);

  // Append any orphaned layers (shouldn't normally exist, safety net)
  for (const layer of Object.values(layers)) {
    if (!result.find((r) => r.layer.id === layer.id)) {
      result.push({ layer, depth: 0 });
    }
  }

  return result;
}

interface LayerRowProps {
  layer: Layer;
  depth: number;
  isCurrent: boolean;
  onNavigate: (id: string) => void;
  onUpdateLayer: (id: string, updates: { name?: string; description?: string }) => void;
}

function LayerRow({ layer, depth, isCurrent, onNavigate, onUpdateLayer }: LayerRowProps) {
  const isRoot = layer.id === ROOT_LAYER_ID;
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(layer.name);
  const [descOpen, setDescOpen] = useState(false);
  const [descValue, setDescValue] = useState(layer.description ?? '');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Sync when layer prop changes externally
  useEffect(() => {
    setNameValue(layer.name);
  }, [layer.name]);

  useEffect(() => {
    setDescValue(layer.description ?? '');
  }, [layer.description]);

  const commitName = () => {
    const trimmed = nameValue.trim() || layer.name;
    setNameValue(trimmed);
    setEditingName(false);
    if (trimmed !== layer.name) {
      onUpdateLayer(layer.id, { name: trimmed });
    }
  };

  const commitDesc = (value: string) => {
    setDescValue(value);
    onUpdateLayer(layer.id, { description: value });
  };

  return (
    <div
      className={`rounded-lg transition-colors ${isCurrent ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
      style={{ marginLeft: depth * 16 }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <Layers size={13} className={isCurrent ? 'text-blue-500' : 'text-slate-400'} />

        {/* Editable name — root layer is locked */}
        {editingName && !isRoot ? (
          <input
            ref={nameInputRef}
            autoFocus
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') {
                setNameValue(layer.name);
                setEditingName(false);
              }
              e.stopPropagation();
            }}
            className="min-w-0 flex-1 rounded border border-blue-300 bg-white px-2 py-0.5 text-sm font-medium text-slate-800 outline-none focus:ring-1 focus:ring-blue-400"
          />
        ) : isRoot ? (
          <span
            className={`min-w-0 flex-1 truncate text-sm font-medium ${
              isCurrent ? 'text-blue-700' : 'text-slate-700'
            }`}
          >
            {layer.name}
          </span>
        ) : (
          <button
            onClick={() => setEditingName(true)}
            title="Click to rename"
            className={`min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline ${
              isCurrent ? 'text-blue-700' : 'text-slate-700'
            }`}
          >
            {layer.name}
          </button>
        )}

        {/* Description toggle */}
        <button
          onClick={() => setDescOpen((o) => !o)}
          title={descOpen ? 'Hide description' : 'Show/edit description'}
          className="flex-shrink-0 text-slate-400 hover:text-slate-600"
        >
          {descOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>

        {/* Navigate */}
        {!isCurrent && (
          <button
            onClick={() => onNavigate(layer.id)}
            title="Navigate to this layer"
            className="flex-shrink-0 rounded p-0.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
          >
            <ArrowRight size={13} />
          </button>
        )}
        {isCurrent && (
          <span className="flex-shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-blue-600">
            current
          </span>
        )}
      </div>

      {/* Description textarea */}
      {descOpen && (
        <div className="px-3 pb-2">
          <textarea
            value={descValue}
            placeholder="Add a description for this layer…"
            rows={2}
            onChange={(e) => setDescValue(e.target.value)}
            onBlur={(e) => commitDesc(e.target.value)}
            className="w-full resize-none rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 placeholder-slate-300 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
          />
        </div>
      )}
    </div>
  );
}

export default function LayersPanel({
  layers,
  currentLayerId,
  onClose,
  onNavigate,
  onUpdateLayer,
}: LayersPanelProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const tree = buildTree(layers);

  const handleNavigate = (layerId: string) => {
    onNavigate(layerId);
    onClose();
  };

  return (
    <div
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-20 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-800">All Layers</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              {Object.keys(layers).length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={15} />
          </button>
        </div>

        {/* Layer list */}
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {tree.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No layers yet</p>
          ) : (
            <div className="space-y-0.5">
              {tree.map(({ layer, depth }) => (
                <LayerRow
                  key={layer.id}
                  layer={layer}
                  depth={depth}
                  isCurrent={layer.id === currentLayerId}
                  onNavigate={handleNavigate}
                  onUpdateLayer={onUpdateLayer}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-3">
          <p className="text-xs text-slate-400">
            Click a layer name to rename it. Use the arrow to navigate. Root layer name is fixed.
          </p>
        </div>
      </div>
    </div>
  );
}
