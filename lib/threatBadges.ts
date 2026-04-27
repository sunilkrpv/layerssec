import type { ThreatSeverity, ThreatStatus, StrideCategory } from '@/lib/api';

export const SEVERITY_OPTIONS: ThreatSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
export const STATUS_OPTIONS: ThreatStatus[] = ['IDENTIFIED', 'IN_PROGRESS', 'MITIGATED', 'ACCEPTED', 'FALSE_POSITIVE'];
export const STRIDE_OPTIONS: StrideCategory[] = [
  'SPOOFING', 'TAMPERING', 'REPUDIATION',
  'INFORMATION_DISCLOSURE', 'DENIAL_OF_SERVICE', 'ELEVATION_OF_PRIVILEGE',
];

export const STRIDE_LABEL: Record<StrideCategory, string> = {
  SPOOFING:               'Spoofing',
  TAMPERING:              'Tampering',
  REPUDIATION:            'Repudiation',
  INFORMATION_DISCLOSURE: 'Info Disclosure',
  DENIAL_OF_SERVICE:      'Denial of Service',
  ELEVATION_OF_PRIVILEGE: 'Elevation of Priv.',
};

export const STRIDE_FULL_LABEL: Record<StrideCategory, string> = {
  SPOOFING:               'Spoofing',
  TAMPERING:              'Tampering',
  REPUDIATION:            'Repudiation',
  INFORMATION_DISCLOSURE: 'Information Disclosure',
  DENIAL_OF_SERVICE:      'Denial of Service',
  ELEVATION_OF_PRIVILEGE: 'Elevation of Privilege',
};

export const STATUS_LABEL: Record<ThreatStatus, string> = {
  IDENTIFIED:    'Identified',
  IN_PROGRESS:   'In Progress',
  MITIGATED:     'Mitigated',
  ACCEPTED:      'Accepted',
  FALSE_POSITIVE:'Dismissed',
};

export const SEV_SHORT: Record<ThreatSeverity, string> = {
  CRITICAL: 'CRIT', HIGH: 'HIGH', MEDIUM: 'MED', LOW: 'LOW', INFO: 'INFO',
};

// RGB triples for heatmap cell backgrounds (dynamic alpha applied at render).
export const SEVERITY_COLOR_RGB: Record<ThreatSeverity, string> = {
  CRITICAL: '220, 38, 38',
  HIGH:     '234, 88, 12',
  MEDIUM:   '202, 138, 4',
  LOW:      '22, 163, 74',
  INFO:     '100, 116, 139',
};

export function formatThreatDate(iso: string): string {
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
