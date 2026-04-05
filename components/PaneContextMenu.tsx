'use client';

import { useEffect, useRef } from 'react';
import { useReactFlow } from 'reactflow';
import { ZoomIn, ZoomOut, Maximize2, Zap, Wand2 } from 'lucide-react';

interface PaneContextMenuProps {
  x: number;
  y: number;
  animateEdges: boolean;
  onToggleAnimateEdges: () => void;
  onClose: () => void;
  /** When provided, shows the Declutter option (only for non-empty, non-read-only diagrams) */
  onDeclutter?: () => void;
}

export default function PaneContextMenu({
  x,
  y,
  animateEdges,
  onToggleAnimateEdges,
  onClose,
  onDeclutter,
}: PaneContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { zoomIn, zoomOut, fitView } = useReactFlow();

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

  function Item({
    icon,
    label,
    onClick,
    active,
    hint,
  }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    active?: boolean;
    hint?: string;
  }) {
    return (
      <button
        onClick={() => { onClick(); onClose(); }}
        className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
          active
            ? 'text-violet-600 dark:text-violet-400'
            : 'text-slate-700 dark:text-slate-200'
        }`}
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {hint && <span className="text-[10px] text-slate-400 dark:text-slate-500">{hint}</span>}
        {active && !hint && (
          <span className="text-[10px] font-semibold text-violet-500 dark:text-violet-400">ON</span>
        )}
      </button>
    );
  }

  return (
    <div
      ref={ref}
      style={{ top: y, left: x }}
      className="fixed z-50 min-w-[180px] rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="border-b border-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400 dark:border-slate-700 dark:text-slate-500">
        View
      </div>

      <Item icon={<ZoomIn size={14} />} label="Zoom In" hint="⌘+" onClick={() => zoomIn()} />
      <Item icon={<ZoomOut size={14} />} label="Zoom Out" hint="⌘−" onClick={() => zoomOut()} />
      <Item icon={<Maximize2 size={14} />} label="Fit View" hint="⌘⇧F" onClick={() => fitView({ padding: 0.15 })} />

      <div className="my-1 h-px bg-slate-100 dark:bg-slate-700" />

      <Item
        icon={<Zap size={14} />}
        label="Animate Edges"
        active={animateEdges}
        onClick={onToggleAnimateEdges}
      />

      {onDeclutter && (
        <>
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-700" />
          <div className="px-3 py-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">AI</div>
          <Item
            icon={<Wand2 size={14} />}
            label="Declutter Layout"
            onClick={onDeclutter}
          />
        </>
      )}
    </div>
  );
}
