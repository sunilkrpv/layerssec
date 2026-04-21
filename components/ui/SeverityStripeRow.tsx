'use client';

import { LiHTMLAttributes, ReactNode } from 'react';
import type { SeverityValue } from './StatusPill';

export interface SeverityStripeRowProps extends LiHTMLAttributes<HTMLLIElement> {
  severity: SeverityValue;
  children: ReactNode;
}

const STRIPE_CLASSES: Record<SeverityValue, string> = {
  critical: 'border-l-red-500 dark:border-l-red-400',
  high: 'border-l-orange-500 dark:border-l-orange-400',
  medium: 'border-l-amber-500 dark:border-l-amber-400',
  low: 'border-l-emerald-500 dark:border-l-emerald-400',
  info: 'border-l-slate-300 dark:border-l-slate-700',
};

export function SeverityStripeRow({ severity, children, className = '', ...rest }: SeverityStripeRowProps) {
  return (
    <li
      {...rest}
      className={`flex items-center border-l-[3px] pr-3 ${STRIPE_CLASSES[severity]} hover:bg-slate-50 dark:hover:bg-slate-800/50 ${className}`.trim()}
    >
      {children}
    </li>
  );
}
