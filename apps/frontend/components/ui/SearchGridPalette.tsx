'use client';

import { KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

export interface PaletteCategory {
  id: string;
  label: string;
}

export interface PaletteItem {
  id: string;
  name: string;
  category: string;
  icon: ReactNode;
}

export interface SearchGridPaletteProps {
  categories: PaletteCategory[];
  items: PaletteItem[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  /** Optional per-tile render override. If provided, caller is responsible
   * for rendering an element that:
   *   - sets `data-palette-item` attribute for keyboard nav
   *   - sets `aria-label` to the item's accessible name
   *   - invokes `defaultProps.onClick` (and is focusable via tabIndex)
   */
  renderItem?: (item: PaletteItem, defaultProps: {
    active: boolean;
    onClick: () => void;
    className: string;
    'data-palette-item': true;
    'aria-label': string;
    tabIndex: 0;
  }) => ReactNode;
}

export function SearchGridPalette({ categories, items, selectedId, onSelect, renderItem }: SearchGridPaletteProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(categories[0]?.id ?? '');
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (category !== 'all' && i.category !== category) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, category, query]);

  const handleGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) return;
    const elements = Array.from(gridRef.current?.querySelectorAll<HTMLElement>('[data-palette-item]') ?? []);
    const current = elements.indexOf(document.activeElement as HTMLElement);
    if (current === -1) { elements[0]?.focus(); return; }
    let next = current;
    if (e.key === 'ArrowRight') next = (current + 1) % elements.length;
    if (e.key === 'ArrowLeft') next = (current - 1 + elements.length) % elements.length;
    if (e.key === 'ArrowDown') next = Math.min(elements.length - 1, current + 3);
    if (e.key === 'ArrowUp') next = Math.max(0, current - 3);
    if (e.key === 'Enter') { (elements[current] as HTMLElement | undefined)?.click(); return; }
    e.preventDefault();
    elements[next]?.focus();
  };

  return (
    <div className="flex h-full flex-col bg-white border-r border-slate-200 dark:bg-slate-900 dark:border-slate-800">
      <div className="flex-shrink-0 border-b border-slate-200 p-2 dark:border-slate-800">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search… (/)"
            className="w-full rounded bg-slate-50 border border-slate-200 py-1.5 pl-7 pr-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:placeholder-slate-500 dark:focus:border-blue-400"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`rounded-full px-2 py-0.5 text-xs ${
                c.id === category
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={gridRef} onKeyDown={handleGridKeyDown} className="grid flex-1 auto-rows-max grid-cols-3 gap-1 overflow-auto p-2">
        {filtered.map((item) => {
          const active = item.id === selectedId;
          const className = `flex aspect-square min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded border text-xs ${
            active
              ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-500/15 dark:border-blue-400 dark:text-blue-300'
              : 'border-transparent text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
          }`;
          const onClick = () => onSelect(item.id);
          if (renderItem) {
            return (
              <div key={item.id} className="contents">
                {renderItem(item, {
                  active,
                  onClick,
                  className,
                  'data-palette-item': true,
                  'aria-label': item.name,
                  tabIndex: 0,
                })}
              </div>
            );
          }
          return (
            <button
              key={item.id}
              data-palette-item
              type="button"
              onClick={onClick}
              aria-label={item.name}
              className={className}
            >
              {item.icon}
              <span className="w-full truncate px-1 text-center">{item.name}</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">No matches</div>
        )}
      </div>
    </div>
  );
}
