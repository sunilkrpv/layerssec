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
