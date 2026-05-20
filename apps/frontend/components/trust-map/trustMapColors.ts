import type { TrustLevel } from '@/lib/trustMap';
import type { ThreatSeverity } from '@/lib/api';

export interface TrustLevelStyle {
  border: string;
  fill: string;
  badge: string;
  label: string;
}

export const TRUST_LEVEL_STYLES: Record<TrustLevel, TrustLevelStyle> = {
  internet: {
    border: '#b91c1c',
    fill: 'rgba(185, 28, 28, 0.06)',
    badge: 'bg-red-200 text-red-800 border-red-400',
    label: 'INTERNET',
  },
  external: {
    border: '#ef4444',
    fill: 'rgba(239, 68, 68, 0.06)',
    badge: 'bg-red-100 text-red-700 border-red-300',
    label: 'EXTERNAL',
  },
  dmz: {
    border: '#f59e0b',
    fill: 'rgba(245, 158, 11, 0.06)',
    badge: 'bg-amber-100 text-amber-700 border-amber-300',
    label: 'DMZ',
  },
  internal: {
    border: '#22c55e',
    fill: 'rgba(34, 197, 94, 0.06)',
    badge: 'bg-green-100 text-green-700 border-green-300',
    label: 'INTERNAL',
  },
  custom: {
    border: '#64748b',
    fill: 'rgba(100, 116, 139, 0.06)',
    badge: 'bg-slate-100 text-slate-600 border-slate-300',
    label: 'CUSTOM',
  },
};

export function severityStroke(s: ThreatSeverity | null): string {
  switch (s) {
    case 'CRITICAL': return '#dc2626';
    case 'HIGH':     return '#ea580c';
    case 'MEDIUM':   return '#f59e0b';
    case 'LOW':      return '#0891b2';
    case 'INFO':     return '#64748b';
    default:         return '#94a3b8';
  }
}

export function severityBadge(s: ThreatSeverity): string {
  switch (s) {
    case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-200';
    case 'HIGH':     return 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-200';
    case 'MEDIUM':   return 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200';
    case 'LOW':      return 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900/40 dark:text-cyan-200';
    case 'INFO':     return 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300';
  }
}
