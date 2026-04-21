'use client';

import { ReactElement, cloneElement, useEffect, useId, useRef, useState, KeyboardEvent } from 'react';

export interface DropdownMenuItem {
  value: string;
  label: string;
}

export interface DropdownMenuProps {
  trigger: ReactElement;
  items: DropdownMenuItem[];
  onSelect: (value: string) => void;
}

export function DropdownMenu({ trigger, items, onSelect }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) menuRef.current?.focus();
  }, [open]);

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setFocused(0);
    }
  };

  const handleMenuKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused((i) => (i + 1) % items.length); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setFocused((i) => (i - 1 + items.length) % items.length); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(items[focused].value);
      setOpen(false);
    }
  };

  const clonedTrigger = cloneElement(trigger, {
    onClick: () => setOpen((o) => !o),
    onKeyDown: handleTriggerKeyDown,
    'aria-haspopup': 'listbox',
    'aria-expanded': open,
  } as Record<string, unknown>);

  return (
    <div ref={rootRef} className="relative inline-block">
      {clonedTrigger}
      {open && (
        <ul
          ref={menuRef}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={`${listboxId}-option-${focused}`}
          onKeyDown={handleMenuKeyDown}
          className="absolute left-0 top-full z-50 mt-1 min-w-[10rem] overflow-hidden rounded border border-slate-200 bg-white shadow-lg focus:outline-none dark:border-slate-700 dark:bg-slate-900"
        >
          {items.map((item, i) => (
            <li
              key={item.value}
              id={`${listboxId}-option-${i}`}
              role="option"
              aria-selected={i === focused}
              onMouseEnter={() => setFocused(i)}
              onClick={() => { onSelect(item.value); setOpen(false); }}
              className={`cursor-pointer px-3 py-1.5 text-sm ${
                i === focused
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
