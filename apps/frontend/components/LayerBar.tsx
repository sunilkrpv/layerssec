'use client';

import { ArrowLeft, ChevronRight, Layers, FolderKanban } from 'lucide-react';
import { getLayerPath, ROOT_LAYER_ID, type LayerMap } from '@/lib/layerStore';

interface LayerBarProps {
  layers: LayerMap;
  currentLayerId: string;
  canGoBack: boolean;
  onBack: () => void;
  onNavigate: (layerId: string) => void;
  /** Name of the currently open cloud project — shown in bold before the breadcrumb */
  projectName?: string | null;
}

export default function LayerBar({
  layers,
  currentLayerId,
  canGoBack,
  onBack,
  onNavigate,
  projectName,
}: LayerBarProps) {
  const fullPath = getLayerPath(layers, currentLayerId);
  const atRoot = currentLayerId === ROOT_LAYER_ID;
  const path = atRoot ? fullPath : fullPath.filter((l) => l.id !== ROOT_LAYER_ID);

  return (
    <div className="flex h-9 flex-shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
      <button
        onClick={onBack}
        disabled={!canGoBack}
        title="Go back to previous layer"
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
      >
        <ArrowLeft size={12} />
        Back
      </button>

      <div className="h-4 w-px bg-slate-300 dark:bg-slate-600" />

      {/* Project name — shown before breadcrumb when a cloud project is open */}
      {projectName && (
        <>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <FolderKanban size={13} className="text-blue-500 dark:text-blue-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 max-w-[180px] truncate" title={projectName}>
              {projectName}
            </span>
          </div>
          <ChevronRight size={12} className="flex-shrink-0 text-slate-400 dark:text-slate-500" />
        </>
      )}

      <Layers size={13} className="flex-shrink-0 text-slate-400 dark:text-slate-500" />

      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
        {path.map((layer, i) => (
          <div key={layer.id} className="flex flex-shrink-0 items-center gap-0.5">
            {i > 0 && <ChevronRight size={11} className="text-slate-400 dark:text-slate-500" />}
            <button
              onClick={() => layer.id !== currentLayerId && onNavigate(layer.id)}
              className={`max-w-[160px] truncate rounded px-1.5 py-0.5 text-xs transition-colors ${
                layer.id === currentLayerId
                  ? 'font-semibold text-blue-700 dark:text-blue-400'
                  : 'cursor-pointer text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {layer.name}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
