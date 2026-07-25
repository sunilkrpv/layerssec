'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import MiniDiagramPreview from './MiniDiagramPreview';

interface DiagramPreviewModalProps {
  nodes: unknown[];
  edges: unknown[];
  title?: string;
  onClose: () => void;
}

export default function DiagramPreviewModal({ nodes, edges, title, onClose }: DiagramPreviewModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="mx-auto flex h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
          <span className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">
            {title ?? 'Diagram preview'}
          </span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <MiniDiagramPreview nodes={nodes} edges={edges} className="h-full rounded-none border-0" />
        </div>
      </div>
    </div>
  );
}
