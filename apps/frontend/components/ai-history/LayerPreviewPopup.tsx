'use client';

import dynamic from 'next/dynamic';
import { Layers, Maximize2, Paperclip, X } from 'lucide-react';
import type { Layer } from '@/lib/layerStore';

const MiniDiagramPreview = dynamic(() => import('@/components/MiniDiagramPreview'), { ssr: false });

export interface LayerPreviewPopupProps {
  layer: Layer;
  anchorRect: DOMRect;
  isAttached: boolean;
  onAttach: () => void;
  onClose: () => void;
  onMaximize: () => void;
}

export function LayerPreviewPopup({
  layer, anchorRect, isAttached, onAttach, onClose, onMaximize,
}: LayerPreviewPopupProps) {
  const style: React.CSSProperties = {
    position: 'fixed',
    left: anchorRect.right + 8,
    top: Math.min(anchorRect.top, window.innerHeight - 340),
    width: 320,
    zIndex: 60,
  };

  return (
    <div style={style} className="rounded-2xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5 dark:border-white/10 dark:bg-gray-900">
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 dark:border-white/10">
        <Layers size={13} className="flex-shrink-0 text-indigo-400" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800 dark:text-white">
          {layer.name}
        </span>
        <span className="text-[10px] text-gray-400">{layer.nodes.length} nodes</span>
        {layer.nodes.length > 0 && (
          <button
            onClick={onMaximize}
            title="Maximize preview"
            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
          >
            <Maximize2 size={11} />
          </button>
        )}
        <button onClick={onClose} className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10">
          <X size={12} />
        </button>
      </div>

      <div className="h-48 overflow-hidden">
        {layer.nodes.length > 0 ? (
          <MiniDiagramPreview nodes={layer.nodes} edges={layer.edges} className="h-full w-full rounded-none border-0" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-400 dark:text-gray-600">
            Empty layer
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 px-3 py-2 dark:border-white/10">
        <button
          onClick={onAttach}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${isAttached ? 'bg-blue-50 text-blue-600 ring-1 ring-indigo-200 hover:bg-indigo-100 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-indigo-700' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
        >
          <Paperclip size={11} />
          {isAttached ? 'Detach from chat' : 'Attach to chat context'}
        </button>
      </div>
    </div>
  );
}
