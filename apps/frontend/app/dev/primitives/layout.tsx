'use client';

import { ReactNode, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function PrimitivesLayout({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [dark]);

  return (
    <div className="flex h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <h1 className="text-sm font-semibold">Layers · UI primitives</h1>
        <button
          onClick={() => setDark((d) => !d)}
          className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {dark ? <Sun size={14} /> : <Moon size={14} />}
          Toggle {dark ? 'light' : 'dark'}
        </button>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
