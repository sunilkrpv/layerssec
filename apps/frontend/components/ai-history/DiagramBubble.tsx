'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Maximize2, Zap } from 'lucide-react';
import type { DiagramPayload } from '@/lib/aiHistoryHelpers';

const MiniDiagramPreview = dynamic(() => import('@/components/MiniDiagramPreview'), { ssr: false });

export interface DiagramBubbleProps {
  diagram: DiagramPayload;
  onApply: () => void;
  onMaximize: () => void;
}

export function DiagramBubble({ diagram, onApply, onMaximize }: DiagramBubbleProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2 rounded-xl border border-indigo-200 bg-blue-50/50 dark:border-indigo-800/40 dark:bg-indigo-900/10">
      <div className="flex items-center gap-2 border-b border-indigo-100 px-3 py-2 dark:border-indigo-800/30">
        <Zap size={12} className="text-blue-500" />
        <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
          AI Diagram — {diagram.nodes.length} nodes, {diagram.edges.length} edges
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded px-2 py-0.5 text-[10px] font-medium text-blue-500 transition hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
          >
            {expanded ? 'Hide' : 'Preview'}
          </button>
          {expanded && (
            <button
              onClick={onMaximize}
              title="Expand to full view"
              className="rounded p-1 text-indigo-400 transition hover:bg-indigo-100 hover:text-blue-600 dark:hover:bg-indigo-900/40"
            >
              <Maximize2 size={12} />
            </button>
          )}
          <button
            onClick={onApply}
            className="rounded-lg bg-blue-600 px-2.5 py-0.5 text-[10px] font-medium text-white transition hover:bg-blue-500"
          >
            Apply →
          </button>
        </div>
      </div>
      {expanded && (
        <div className="h-56">
          <MiniDiagramPreview nodes={diagram.nodes} edges={diagram.edges} className="h-full w-full rounded-none border-0" />
        </div>
      )}
    </div>
  );
}
