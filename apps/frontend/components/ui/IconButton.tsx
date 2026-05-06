'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Tooltip } from './Tooltip';

type Variant = 'default' | 'destructive';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label' | 'type'> {
  label: string;
  icon: ReactNode;
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  default: 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800',
  destructive: 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10',
};

export function IconButton({ label, icon, variant = 'default', className = '', ...rest }: IconButtonProps) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        {...rest}
        className={`inline-flex h-7 w-7 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`.trim()}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
