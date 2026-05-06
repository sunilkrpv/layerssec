'use client';

import { useRouter } from 'next/navigation';
import { StatusPill } from '@/components/ui/StatusPill';
import { ClickToEditPill } from '@/components/ui/ClickToEditPill';
import { apiUpdateThreat, type ProjectThreat, type ThreatStatus, type StrideCategory } from '@/lib/api';

export interface ThreatsTableProps {
  projectId: string;
  threats: ProjectThreat[];
  loading: boolean;
  onStatusChanged: (id: string, next: ProjectThreat) => void;
}

export function ThreatsTable({ projectId, threats, loading, onStatusChanged }: ThreatsTableProps) {
  const router = useRouter();

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40">
            <Th>Threat</Th>
            <Th hidden="sm">Target</Th>
            <Th>Severity</Th>
            <Th hidden="md">STRIDE</Th>
            <Th>Status</Th>
            <Th hidden="lg">Layer</Th>
            <Th hidden="xl">Source</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {threats.map((t) => {
            const isDismissed = t.status === 'FALSE_POSITIVE';
            return (
              <tr
                key={t.id}
                onClick={() => router.push(`/projects/${projectId}/threats/${t.id}`)}
                className={`group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30 ${isDismissed ? 'opacity-50' : ''}`}
              >
                <td className="max-w-[280px] py-3 pl-4 pr-4">
                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{t.title}</div>
                  <div className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">{t.description}</div>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{t.targetLabel}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusPill variant="severity" value={severityValue(t.severity)} />
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <StatusPill variant="stride" value={strideValue(t.strideCategory)} />
                </td>
                <td
                  className="px-4 py-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ClickToEditPill
                    variant="status"
                    value={statusValue(t.status)}
                    options={['open', 'in-review', 'mitigated', 'dismissed']}
                    onChange={async (nextValue) => {
                      const nextStatus = valueToStatus(nextValue);
                      if (!nextStatus) return;
                      const updated = await apiUpdateThreat(t.threatModel.id, t.id, { status: nextStatus });
                      onStatusChanged(t.id, { ...t, ...updated });
                    }}
                  />
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{layerLabel(t)}</span>
                </td>
                <td className="hidden px-4 py-3 xl:table-cell">
                  <StatusPill variant="source" value={t.identifiedBy === 'AI' ? 'ai' : 'user'} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, hidden }: { children: React.ReactNode; hidden?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const hideCls = hidden ? `hidden ${hidden}:table-cell` : '';
  return (
    <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${hideCls}`}>
      {children}
    </th>
  );
}

// ── Value mappings ────────────────────────────────────────────────────────

function severityValue(s: ProjectThreat['severity']): 'critical' | 'high' | 'medium' | 'low' | 'info' {
  return s.toLowerCase() as 'critical' | 'high' | 'medium' | 'low' | 'info';
}

function strideValue(s: StrideCategory): 'spoofing' | 'tampering' | 'repudiation' | 'info-disclosure' | 'dos' | 'elevation' {
  switch (s) {
    case 'SPOOFING': return 'spoofing';
    case 'TAMPERING': return 'tampering';
    case 'REPUDIATION': return 'repudiation';
    case 'INFORMATION_DISCLOSURE': return 'info-disclosure';
    case 'DENIAL_OF_SERVICE': return 'dos';
    case 'ELEVATION_OF_PRIVILEGE': return 'elevation';
  }
}

function statusValue(s: ThreatStatus): 'open' | 'in-review' | 'mitigated' | 'accepted' | 'dismissed' {
  switch (s) {
    case 'IDENTIFIED': return 'open';
    case 'IN_PROGRESS': return 'in-review';
    case 'MITIGATED': return 'mitigated';
    case 'ACCEPTED': return 'accepted';
    case 'FALSE_POSITIVE': return 'dismissed';
  }
}

function valueToStatus(v: string): ThreatStatus | null {
  switch (v) {
    case 'open': return 'IDENTIFIED';
    case 'in-review': return 'IN_PROGRESS';
    case 'mitigated': return 'MITIGATED';
    case 'accepted': return 'ACCEPTED';
    case 'dismissed': return 'FALSE_POSITIVE';
  }
  return null;
}

function layerLabel(t: ProjectThreat): string {
  return t.layerId ? t.layerId.slice(-8) : 'root';
}
