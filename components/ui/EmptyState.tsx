'use client';

import { ReactNode } from 'react';

export interface EmptyStateProps {
  icon: ReactNode;
  heading: string;
  subtext: string;
  cta?: ReactNode;
}

export function EmptyState({ icon, heading, subtext, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        {icon}
      </div>
      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{heading}</div>
      <div className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{subtext}</div>
      {cta}
    </div>
  );
}
