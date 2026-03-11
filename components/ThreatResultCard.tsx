'use client';

import { type ThreatItem, type StrideCategory, type ThreatSeverity } from '@/lib/api';

const STRIDE_CONFIG: Record<StrideCategory, { label: string; badgeCls: string }> = {
  SPOOFING:             { label: 'Spoofing',            badgeCls: 'text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700' },
  TAMPERING:            { label: 'Tampering',           badgeCls: 'text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700' },
  REPUDIATION:          { label: 'Repudiation',         badgeCls: 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700' },
  INFORMATION_DISCLOSURE: { label: 'Info Disclosure',   badgeCls: 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/40 border-rose-300 dark:border-rose-700' },
  DENIAL_OF_SERVICE:    { label: 'Denial of Service',   badgeCls: 'text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700' },
  ELEVATION_OF_PRIVILEGE: { label: 'Elevation of Priv.', badgeCls: 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700' },
};

const SEVERITY_CONFIG: Record<ThreatSeverity, { label: string; badgeCls: string }> = {
  CRITICAL: { label: 'CRITICAL', badgeCls: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700' },
  HIGH:     { label: 'HIGH',     badgeCls: 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700' },
  MEDIUM:   { label: 'MEDIUM',   badgeCls: 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700' },
  LOW:      { label: 'LOW',      badgeCls: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700' },
  INFO:     { label: 'INFO',     badgeCls: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600' },
};

interface ThreatResultCardProps {
  threat: ThreatItem;
  isDark?: boolean;
  onClick?: () => void;
  isActive?: boolean;
}

export default function ThreatResultCard({ threat, onClick, isActive = false }: ThreatResultCardProps) {
  const stride = STRIDE_CONFIG[threat.strideCategory] ?? STRIDE_CONFIG.SPOOFING;
  const severity = SEVERITY_CONFIG[threat.severity] ?? SEVERITY_CONFIG.MEDIUM;

  return (
    <div
      onClick={onClick}
      className={[
        'rounded-xl border p-3.5 space-y-2 transition-all',
        'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40',
        onClick ? 'cursor-pointer' : '',
        isActive
          ? 'ring-2 ring-amber-400 border-amber-300 dark:ring-amber-400/70 dark:border-amber-400/40'
          : onClick
            ? 'hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-800/60'
            : '',
      ].join(' ')}
    >
      {/* Row 1: Title */}
      <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
        {threat.title}
      </p>

      {/* Row 2: Severity + STRIDE badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${severity.badgeCls}`}>
          {severity.label}
        </span>
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${stride.badgeCls}`}>
          {stride.label}
        </span>
      </div>

      {/* Row 3: Target node / edge name */}
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {threat.targetLabel}
      </p>

      {/* Row 4: Description */}
      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {threat.description}
      </p>
    </div>
  );
}
