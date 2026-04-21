'use client';

import type { HTMLAttributes } from 'react';

export type SeverityValue = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type StrideValue = 'spoofing' | 'tampering' | 'repudiation' | 'info-disclosure' | 'dos' | 'elevation';
export type StatusValue = 'open' | 'in-review' | 'mitigated' | 'dismissed' | 'accepted';
export type SourceValue = 'ai' | 'user';
export type TrustValue = 'internal' | 'dmz' | 'external' | 'internet';

export type StatusPillProps =
  | ({ variant: 'severity'; value: SeverityValue } & HTMLAttributes<HTMLSpanElement>)
  | ({ variant: 'stride'; value: StrideValue } & HTMLAttributes<HTMLSpanElement>)
  | ({ variant: 'status'; value: StatusValue } & HTMLAttributes<HTMLSpanElement>)
  | ({ variant: 'source'; value: SourceValue } & HTMLAttributes<HTMLSpanElement>)
  | ({ variant: 'trust'; value: TrustValue } & HTMLAttributes<HTMLSpanElement>);

const SEVERITY_CLASSES: Record<SeverityValue, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  info: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
};

const STRIDE_CLASSES: Record<StrideValue, string> = {
  spoofing: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  tampering: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  repudiation: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300',
  'info-disclosure': 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  dos: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
  elevation: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
};

const STATUS_CLASSES: Record<StatusValue, string> = {
  open: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  'in-review': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  mitigated: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  dismissed: 'bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400',
  accepted: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
};

const SOURCE_CLASSES: Record<SourceValue, string> = {
  ai: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  user: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
};

const TRUST_CLASSES: Record<TrustValue, string> = {
  internal: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  dmz: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  external: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  internet: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

const LABELS: Record<string, string> = {
  'info-disclosure': 'Info Disclosure',
  'in-review': 'In Review',
  dmz: 'DMZ',
  dos: 'DoS',
  ai: 'AI',
};

function toLabel(value: string): string {
  if (LABELS[value]) return LABELS[value];
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function StatusPill(props: StatusPillProps) {
  const { variant, value, className = '', ...rest } = props as { variant: string; value: string; className?: string } & HTMLAttributes<HTMLSpanElement>;

  let variantClass = '';
  if (variant === 'severity') variantClass = SEVERITY_CLASSES[value as SeverityValue];
  else if (variant === 'stride') variantClass = STRIDE_CLASSES[value as StrideValue];
  else if (variant === 'status') variantClass = STATUS_CLASSES[value as StatusValue];
  else if (variant === 'source') variantClass = SOURCE_CLASSES[value as SourceValue];
  else if (variant === 'trust') variantClass = TRUST_CLASSES[value as TrustValue];

  return (
    <span
      {...rest}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variantClass} ${className}`.trim()}
    >
      {toLabel(value)}
    </span>
  );
}
