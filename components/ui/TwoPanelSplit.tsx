'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const STORAGE_KEY = 'layers_right_panel_width';
const DEFAULT_WIDTH = 360;
const MIN_WIDTH = 240;
const MAX_WIDTH = 720;

export interface TwoPanelSplitProps {
  left: ReactNode;
  right: ReactNode | null;
}

function readWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
  return DEFAULT_WIDTH;
}

export function TwoPanelSplit({ left, right }: TwoPanelSplitProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const widthRef = useRef(DEFAULT_WIDTH);
  const dragging = useRef(false);

  useEffect(() => {
    const initial = readWidth();
    widthRef.current = initial;
    setWidth(initial);
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const fromRight = window.innerWidth - e.clientX;
      const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, fromRight));
      widthRef.current = clamped;
      setWidth(clamped);
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      window.localStorage.setItem(STORAGE_KEY, String(widthRef.current));
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (dragging.current) document.body.style.cursor = '';
    };
  }, []);

  return (
    <div className="relative flex h-full w-full">
      <div className="min-w-0 flex-1 overflow-auto">{left}</div>
      {right && (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={() => { dragging.current = true; document.body.style.cursor = 'col-resize'; }}
            className="w-1 cursor-col-resize bg-slate-200 hover:bg-blue-400 dark:bg-slate-800"
          />
          <aside
            style={{ width }}
            className="flex h-full flex-col overflow-hidden bg-white border-l border-slate-200 dark:bg-slate-950 dark:border-slate-800"
          >
            {right}
          </aside>
        </>
      )}
    </div>
  );
}

export interface PanelHeaderProps {
  title: string;
  icon?: ReactNode;
  onClose?: () => void;
}

function PanelHeader({ title, icon, onClose }: PanelHeaderProps) {
  return (
    <header className="flex h-9 flex-shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-800 dark:bg-slate-900">
      {icon}
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="ml-auto rounded p-1 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <X size={14} />
        </button>
      )}
    </header>
  );
}

TwoPanelSplit.Header = PanelHeader;
