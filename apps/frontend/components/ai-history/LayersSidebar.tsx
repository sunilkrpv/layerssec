'use client';

import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { LayerTreeNode } from '@/components/ai-history/LayerTreeNode';
import type { Layer, LayerMap } from '@/lib/layerStore';

export interface LayersSidebarProps {
  diagramLayers: LayerMap | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  expandedLayerIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onPreview: (id: string, rect: DOMRect) => void;
  attachedLayerIds: string[];
  onAttachToggle: (layer: Layer) => void;
  attachDisabled: (layer: Layer) => boolean;
}

export function LayersSidebar({
  diagramLayers, collapsed, onToggleCollapsed, expandedLayerIds, onToggleExpand,
  onPreview, attachedLayerIds, onAttachToggle, attachDisabled,
}: LayersSidebarProps) {
  if (collapsed) {
    return (
      <div className="flex w-8 flex-shrink-0 flex-col border-r border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900">
        <button
          onClick={onToggleCollapsed}
          title="Show layers"
          className="flex h-9 w-full items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5"
        >
          <ChevronRight size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-52 flex-shrink-0 overflow-hidden border-r border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900">
      <div className="flex h-full flex-col">
        <div className="flex flex-shrink-0 items-center border-b border-gray-200 px-3 py-2.5 dark:border-white/10">
          <Layers size={11} className="mr-1.5 text-indigo-400" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Layers
          </span>
          <button
            onClick={onToggleCollapsed}
            title="Hide layers"
            className="ml-auto rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
          >
            <ChevronLeft size={12} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5">
          {diagramLayers ? (
            Object.values(diagramLayers)
              .filter((l) => l.parentLayerId === null)
              .map((root) => (
                <LayerTreeNode
                  key={root.id}
                  layer={root}
                  layers={diagramLayers}
                  depth={0}
                  expanded={expandedLayerIds}
                  onToggle={onToggleExpand}
                  onPreview={onPreview}
                  attachedLayerIds={attachedLayerIds}
                  onAttachToggle={onAttachToggle}
                  attachDisabled={attachDisabled}
                />
              ))
          ) : (
            <div className="px-3 pt-6">
              <span className="text-xs text-gray-400 dark:text-gray-600">No layers loaded</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
