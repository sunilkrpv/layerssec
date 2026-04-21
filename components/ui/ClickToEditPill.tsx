'use client';

import type { ComponentProps } from 'react';
import { StatusPill } from './StatusPill';
import { DropdownMenu } from './DropdownMenu';

type VariantOf<V extends ComponentProps<typeof StatusPill>['variant']> = Extract<
  ComponentProps<typeof StatusPill>,
  { variant: V }
>['value'];

export interface ClickToEditPillProps<V extends ComponentProps<typeof StatusPill>['variant']> {
  variant: V;
  value: VariantOf<V>;
  options: VariantOf<V>[];
  onChange: (next: VariantOf<V>) => void;
  disabled?: boolean;
}

const LABELS: Record<string, string> = {
  'info-disclosure': 'Info Disclosure',
  'in-review': 'In Review',
  dmz: 'DMZ',
  dos: 'DoS',
  ai: 'AI',
};

function toLabel(v: string): string {
  if (LABELS[v]) return LABELS[v];
  return v.charAt(0).toUpperCase() + v.slice(1);
}

export function ClickToEditPill<V extends ComponentProps<typeof StatusPill>['variant']>({
  variant,
  value,
  options,
  onChange,
  disabled,
}: ClickToEditPillProps<V>) {
  const pill = <StatusPill {...({ variant, value } as ComponentProps<typeof StatusPill>)} />;

  if (disabled) return pill;

  const trigger = (
    <button
      type="button"
      className="rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-blue-400 dark:focus:ring-offset-slate-900"
    >
      {pill}
    </button>
  );

  return (
    <DropdownMenu
      trigger={trigger}
      items={options.map((o) => ({ value: o as string, label: toLabel(o as string) }))}
      onSelect={(v) => onChange(v as VariantOf<V>)}
    />
  );
}
