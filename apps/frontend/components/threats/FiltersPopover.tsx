'use client';

import { useEffect, useRef, useState } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { Button } from '@/components/ui/Button';
import type { ThreatSeverity, ThreatStatus, StrideCategory } from '@/lib/api';
import {
  SEVERITY_OPTIONS, STATUS_OPTIONS, STRIDE_OPTIONS,
  STATUS_LABEL, STRIDE_LABEL,
} from '@/lib/threatBadges';

export interface FiltersValue {
  severity: ThreatSeverity | 'ALL';
  status: ThreatStatus | 'ALL';
  stride: StrideCategory | 'ALL';
}

export interface FiltersPopoverProps extends FiltersValue {
  onChange: (next: FiltersValue) => void;
}

export function FiltersPopover({ severity, status, stride, onChange }: FiltersPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeCount =
    (severity !== 'ALL' ? 1 : 0) + (status !== 'ALL' ? 1 : 0) + (stride !== 'ALL' ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const set = (patch: Partial<FiltersValue>) => {
    onChange({ severity, status, stride, ...patch });
  };

  const triggerActive = activeCount > 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
          triggerActive
            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        <Filter size={13} />
        <span>Filters</span>
        {triggerActive && (
          <span className="rounded-full bg-blue-500 px-1.5 text-[10px] font-bold text-white">{activeCount}</span>
        )}
        <ChevronDown size={11} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <FilterRow label="Severity">
            <DropdownMenu
              trigger={<TriggerLabel value={severity === 'ALL' ? 'All severities' : severity} />}
              items={[
                { value: 'ALL', label: 'All severities', onSelect: () => set({ severity: 'ALL' }) },
                ...SEVERITY_OPTIONS.map((s) => ({ value: s, label: s, onSelect: () => set({ severity: s }) })),
              ]}
            />
          </FilterRow>

          <FilterRow label="Status">
            <DropdownMenu
              trigger={<TriggerLabel value={status === 'ALL' ? 'All statuses' : STATUS_LABEL[status]} />}
              items={[
                { value: 'ALL', label: 'All statuses', onSelect: () => set({ status: 'ALL' }) },
                ...STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s], onSelect: () => set({ status: s }) })),
              ]}
            />
          </FilterRow>

          <FilterRow label="STRIDE">
            <DropdownMenu
              trigger={<TriggerLabel value={stride === 'ALL' ? 'All STRIDE' : STRIDE_LABEL[stride]} />}
              items={[
                { value: 'ALL', label: 'All STRIDE', onSelect: () => set({ stride: 'ALL' }) },
                ...STRIDE_OPTIONS.map((s) => ({ value: s, label: STRIDE_LABEL[s], onSelect: () => set({ stride: s }) })),
              ]}
            />
          </FilterRow>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onChange({ severity: 'ALL', status: 'ALL', stride: 'ALL' })}
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Clear all
            </button>
            <Button variant="primary" onClick={() => setOpen(false)} className="h-7 px-3 py-0 text-xs">
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </div>
  );
}

function TriggerLabel({ value }: { value: string }) {
  return (
    <button
      type="button"
      className="flex h-7 min-w-[120px] items-center justify-between gap-1 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      <span className="truncate">{value}</span>
      <ChevronDown size={10} />
    </button>
  );
}
