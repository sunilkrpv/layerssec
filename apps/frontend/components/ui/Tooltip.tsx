'use client';

import { KeyboardEvent, ReactElement, cloneElement, useEffect, useId, useRef, useState } from 'react';

export interface TooltipProps {
  content: string;
  children: ReactElement;
  delayMs?: number;
}

export function Tooltip({ content, children, delayMs = 300 }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delayMs);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  const child = cloneElement(children, {
    'aria-describedby': id,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    },
  } as Record<string, unknown>);

  return (
    <span className="relative inline-flex">
      {child}
      {open && (
        <span
          id={id}
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
        >
          {content}
        </span>
      )}
    </span>
  );
}
