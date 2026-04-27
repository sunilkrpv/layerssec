'use client';

import { X } from 'lucide-react';
import type { ThreatSeverity, ThreatStatus, StrideCategory } from '@/lib/api';
import { STATUS_LABEL, STRIDE_LABEL } from '@/lib/threatBadges';

export interface ActiveFilterChipsProps {
  severity: ThreatSeverity | 'ALL';
  status: ThreatStatus | 'ALL';
  stride: StrideCategory | 'ALL';
  onChange: (next: { severity?: ThreatSeverity | 'ALL'; status?: ThreatStatus | 'ALL'; stride?: StrideCategory | 'ALL' }) => void;
}

export function ActiveFilterChips({ severity, status, stride, onChange }: ActiveFilterChipsProps) {
  const hasAny = severity !== 'ALL' || status !== 'ALL' || stride !== 'ALL';
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {severity !== 'ALL' && (
        <Chip label={`Severity: ${severity}`} onClear={() => onChange({ severity: 'ALL' })} />
      )}
      {stride !== 'ALL' && (
        <Chip label={`STRIDE: ${STRIDE_LABEL[stride]}`} onClear={() => onChange({ stride: 'ALL' })} />
      )}
      {status !== 'ALL' && (
        <Chip label={`Status: ${STATUS_LABEL[status]}`} onClear={() => onChange({ status: 'ALL' })} />
      )}
      <button
        type="button"
        onClick={() => onChange({ severity: 'ALL', status: 'ALL', stride: 'ALL' })}
        className="text-xs text-blue-500 underline hover:text-blue-700 dark:hover:text-blue-300"
      >
        Clear all
      </button>
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear filter: ${label}`}
        className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
      >
        <X size={10} />
      </button>
    </span>
  );
}
