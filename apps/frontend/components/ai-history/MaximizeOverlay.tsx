'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { X } from 'lucide-react';

const MiniDiagramPreview = dynamic(() => import('@/components/MiniDiagramPreview'), { ssr: false });

export interface MaximizedPayload {
  nodes: unknown[];
  edges: unknown[];
  layerName?: string;
}

export interface MaximizeOverlayProps {
  payload: MaximizedPayload | null;
  onClose: () => void;
}

export function MaximizeOverlay({ payload, onClose }: MaximizeOverlayProps) {
  useEffect(() => {
    if (!payload) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [payload, onClose]);

  if (!payload) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative h-[88vh] w-[92vw] overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-gray-200 px-4 py-2.5 dark:border-white/10">
          <span className="text-sm font-semibold text-gray-800 dark:text-white">
            {payload.layerName ?? 'Diagram preview'}
          </span>
          <span className="ml-2 text-xs text-gray-400">
            {payload.nodes.length} nodes · {payload.edges.length} edges
          </span>
          <button
            onClick={onClose}
            aria-label="Close maximized preview"
            className="ml-auto rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
          >
            <X size={14} />
          </button>
        </div>
        <div className="h-[calc(100%-44px)]">
          <MiniDiagramPreview nodes={payload.nodes} edges={payload.edges} className="h-full w-full rounded-none border-0" />
        </div>
      </div>
    </div>
  );
}
