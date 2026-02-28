'use client';

import { useEffect, useRef } from 'react';
import { GitBranch, Trash2, FolderOpen, ArrowUpToLine, ArrowDownToLine, Group, Ungroup, ArrowRightLeft, Link } from 'lucide-react';

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeLabel: string;
  hasChildLayer: boolean;
  /** When true the node is a line shape and drill-down is not offered */
  isLine: boolean;
  /** True if the right-clicked node is a group type */
  isGroup: boolean;
  /** Number of currently selected nodes (to enable Group option when >= 2) */
  selectedCount: number;
  onDrillDown: () => void;
  onDelete: () => void;
  onClose: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  /** Called when user wants to reassign this node's child layer to a different shape */
  onReassignLayer?: () => void;
  /** True when there are sibling shapes that can receive the child layer */
  hasReassignableTargets?: boolean;
  /** Called when user wants to assign an orphaned layer to this shape */
  onAssignLayer?: () => void;
  /** True when there are unattached layers available to assign */
  hasAssignableOrphans?: boolean;
}

export default function NodeContextMenu({
  x,
  y,
  nodeLabel,
  hasChildLayer,
  isLine,
  isGroup,
  selectedCount,
  onDrillDown,
  onDelete,
  onClose,
  onBringToFront,
  onSendToBack,
  onGroup,
  onUngroup,
  onReassignLayer,
  hasReassignableTargets,
  onAssignLayer,
  hasAssignableOrphans,
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
      className="fixed z-50 min-w-[180px] rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="truncate border-b border-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400 dark:border-slate-700 dark:text-slate-500">
        {nodeLabel}
      </div>

      {/* Group / Ungroup */}
      {selectedCount >= 2 && (
        <button
          onClick={onGroup}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
        >
          <Group size={14} />
          Group {selectedCount} nodes
        </button>
      )}
      {isGroup && (
        <button
          onClick={onUngroup}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
        >
          <Ungroup size={14} />
          Ungroup
        </button>
      )}
      {(selectedCount >= 2 || isGroup) && <div className="my-1 h-px bg-slate-100 dark:bg-slate-700" />}

      {/* Drill down */}
      {!isLine && (
        <>
          <button
            onClick={onDrillDown}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
          >
            {hasChildLayer ? <FolderOpen size={14} /> : <GitBranch size={14} />}
            {hasChildLayer ? 'Open Layer' : 'Drill Down'}
          </button>
          {hasChildLayer && hasReassignableTargets && onReassignLayer && (
            <button
              onClick={onReassignLayer}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
            >
              <ArrowRightLeft size={14} />
              Reassign Layer
            </button>
          )}
          {!hasChildLayer && hasAssignableOrphans && onAssignLayer && (
            <button
              onClick={onAssignLayer}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
            >
              <Link size={14} />
              Assign Layer
            </button>
          )}
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-700" />
        </>
      )}

      {/* Z-order */}
      <button
        onClick={onBringToFront}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
      >
        <ArrowUpToLine size={14} />
        Bring to Front
      </button>
      <button
        onClick={onSendToBack}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
      >
        <ArrowDownToLine size={14} />
        Send to Back
      </button>

      <div className="my-1 h-px bg-slate-100 dark:bg-slate-700" />

      <button
        onClick={onDelete}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
      >
        <Trash2 size={14} />
        Delete Node
      </button>
    </div>
  );
}
