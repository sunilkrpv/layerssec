'use client';

import { useEffect, useRef } from 'react';
import { GitBranch, Trash2, FolderOpen } from 'lucide-react';

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeLabel: string;
  hasChildLayer: boolean;
  /** When true the node is a line shape and drill-down is not offered */
  isLine: boolean;
  onDrillDown: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function NodeContextMenu({
  x,
  y,
  nodeLabel,
  hasChildLayer,
  isLine,
  onDrillDown,
  onDelete,
  onClose,
}: NodeContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ top: y, left: x }}
      className="fixed z-50 min-w-[168px] rounded-xl border border-slate-200 bg-white py-1 shadow-2xl"
    >
      <div className="truncate border-b border-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400">
        {nodeLabel}
      </div>

      {!isLine && (
        <>
          <button
            onClick={onDrillDown}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700"
          >
            {hasChildLayer ? <FolderOpen size={14} /> : <GitBranch size={14} />}
            {hasChildLayer ? 'Open Layer' : 'Drill Down'}
          </button>
          <div className="my-1 h-px bg-slate-100" />
        </>
      )}

      <button
        onClick={onDelete}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
      >
        <Trash2 size={14} />
        Delete Node
      </button>
    </div>
  );
}
