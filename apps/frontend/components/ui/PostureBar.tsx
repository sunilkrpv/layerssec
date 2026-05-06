'use client';

import { ReactNode } from 'react';

export interface PostureSegment {
  icon?: ReactNode;
  label: string;
  value: number | string;
  delta?: number;
  deltaDirection?: 'good' | 'bad';
}

export interface PostureBarProps {
  segments: PostureSegment[];
}

export function PostureBar({ segments }: PostureBarProps) {
  return (
    <div className="flex overflow-hidden rounded border border-slate-200 bg-white divide-x divide-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:divide-slate-800">
      {segments.map((s, i) => (
        <div key={i} className="flex-1 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            {s.icon}
            <span>{s.label}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{s.value}</span>
            {typeof s.delta === 'number' && (
              <span
                className={`text-xs font-medium ${
                  s.deltaDirection === 'bad'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {s.delta > 0 ? '+' : ''}
                {s.delta}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
