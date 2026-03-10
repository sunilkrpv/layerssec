'use client';

import { type ThreatItem, type StrideCategory, type ThreatSeverity } from '@/lib/api';

const STRIDE_CONFIG: Record<StrideCategory, { label: string; color: string; bg: string }> = {
  SPOOFING: { label: 'S', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700' },
  TAMPERING: { label: 'T', color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700' },
  REPUDIATION: { label: 'R', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700' },
  INFORMATION_DISCLOSURE: { label: 'I', color: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-100 dark:bg-rose-900/40 border-rose-300 dark:border-rose-700' },
  DENIAL_OF_SERVICE: { label: 'D', color: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700' },
  ELEVATION_OF_PRIVILEGE: { label: 'E', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700' },
};

const SEVERITY_CONFIG: Record<ThreatSeverity, { label: string; color: string }> = {
  CRITICAL: { label: 'CRITICAL', color: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700' },
  HIGH: { label: 'HIGH', color: 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700' },
  MEDIUM: { label: 'MEDIUM', color: 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700' },
  LOW: { label: 'LOW', color: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700' },
  INFO: { label: 'INFO', color: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600' },
};

const STRIDE_FULL: Record<StrideCategory, string> = {
  SPOOFING: 'Spoofing',
  TAMPERING: 'Tampering',
  REPUDIATION: 'Repudiation',
  INFORMATION_DISCLOSURE: 'Info Disclosure',
  DENIAL_OF_SERVICE: 'Denial of Service',
  ELEVATION_OF_PRIVILEGE: 'Elevation of Priv.',
};

interface ThreatResultCardProps {
  threat: ThreatItem;
  isDark?: boolean;
}

export default function ThreatResultCard({ threat, isDark = false }: ThreatResultCardProps) {
  const stride = STRIDE_CONFIG[threat.strideCategory] ?? STRIDE_CONFIG.SPOOFING;
  const severity = SEVERITY_CONFIG[threat.severity] ?? SEVERITY_CONFIG.MEDIUM;

  return (
    <div className={`rounded-xl border p-3 text-xs space-y-1.5 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
      {/* Header row */}
      <div className="flex items-start gap-2">
        {/* STRIDE badge */}
        <span className={`flex-shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-md border text-[10px] font-bold ${stride.bg} ${stride.color}`}>
          {stride.label}
        </span>
        {/* Severity badge */}
        <span className={`flex-shrink-0 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${severity.color}`}>
          {severity.label}
        </span>
        {/* Title */}
        <span className={`flex-1 font-semibold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {threat.title}
        </span>
      </div>

      {/* Target + STRIDE category */}
      <div className={`flex items-center gap-1.5 ${isDark ? 'text-indigo-300/60' : 'text-slate-500'}`}>
        <span className="truncate">
          {threat.targetLabel}
        </span>
        <span>·</span>
        <span>{STRIDE_FULL[threat.strideCategory]}</span>
      </div>

      {/* Description */}
      <p className={`leading-relaxed ${isDark ? 'text-indigo-200/70' : 'text-slate-600'}`}>
        {threat.description}
      </p>
    </div>
  );
}
