'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, ArrowLeft, Loader2, AlertCircle,
  Search, Filter, Bot, User, Trash2, ShieldOff,
  ExternalLink, Plus, Sun, Moon, Monitor, LogOut, X, FileText,
  Sparkles, Clock, Copy, Check,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import LayersLogo from '@/components/LayersLogo';
import {
  apiListProjectThreats, apiUpdateThreat, apiDeleteThreat,
  apiCreateThreat, apiListThreatModels, apiGetProject, apiExportThreatReport,
  apiChatAsk,
  type ProjectThreat, type ThreatSeverity, type StrideCategory,
  type ThreatStatus, type ThreatModelSummary, type ThreatItem,
} from '@/lib/api';
import { getStoredUser, signOut } from '@/lib/authStore';
import { useTheme } from '@/lib/themeContext';

// ── Config ────────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: ThreatSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const SEVERITY_BADGE: Record<ThreatSeverity, string> = {
  CRITICAL: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700',
  HIGH:     'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700',
  MEDIUM:   'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700',
  LOW:      'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700',
  INFO:     'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600',
};

const STRIDE_LABEL: Record<StrideCategory, string> = {
  SPOOFING:               'Spoofing',
  TAMPERING:              'Tampering',
  REPUDIATION:            'Repudiation',
  INFORMATION_DISCLOSURE: 'Info Disclosure',
  DENIAL_OF_SERVICE:      'Denial of Service',
  ELEVATION_OF_PRIVILEGE: 'Elevation of Priv.',
};

const STRIDE_OPTIONS = Object.keys(STRIDE_LABEL) as StrideCategory[];

// Markdown renderers for the AI Mitigation Advice card — code blocks get a
// monospace block with horizontal scroll; inline code gets a subtle chip.
const mitigationMdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 text-sm leading-relaxed last:mb-0">{children}</p>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-2 mt-3 text-base font-bold text-slate-900 dark:text-slate-100">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-1.5 mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-1 mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{children}</h3>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-slate-600 dark:text-slate-300">{children}</em>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 ml-4 list-disc space-y-0.5 text-sm">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-0.5 text-sm">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isBlock = /language-/.test(className ?? '');
    return isBlock ? (
      <code className={`font-mono text-xs text-blue-700 dark:text-blue-300 ${className ?? ''}`}>{children}</code>
    ) : (
      <code className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:bg-slate-700 dark:text-blue-300">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="mb-3 overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs leading-relaxed ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
      {children}
    </pre>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a
      href={href}
      className="text-blue-600 underline decoration-blue-400/40 underline-offset-2 hover:text-blue-500 dark:text-blue-400 dark:decoration-blue-500/40 dark:hover:text-blue-300"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="mb-2 border-l-2 border-indigo-300 dark:border-indigo-700 pl-3 italic text-slate-600 dark:text-slate-400">
      {children}
    </blockquote>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-slate-200 dark:border-slate-700 px-2 py-1 align-top">{children}</td>
  ),
};

const STRIDE_FULL_LABEL: Record<StrideCategory, string> = {
  SPOOFING:               'Spoofing',
  TAMPERING:              'Tampering',
  REPUDIATION:            'Repudiation',
  INFORMATION_DISCLOSURE: 'Information Disclosure',
  DENIAL_OF_SERVICE:      'Denial of Service',
  ELEVATION_OF_PRIVILEGE: 'Elevation of Privilege',
};

const STRIDE_BADGE_CLS: Record<StrideCategory, string> = {
  SPOOFING:               'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700',
  TAMPERING:              'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700',
  REPUDIATION:            'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700',
  INFORMATION_DISCLOSURE: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-700',
  DENIAL_OF_SERVICE:      'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700',
  ELEVATION_OF_PRIVILEGE: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700',
};

// RGB values for heat map cell backgrounds (dynamic opacity)
const SEVERITY_COLOR_RGB: Record<ThreatSeverity, string> = {
  CRITICAL: '220, 38, 38',
  HIGH:     '234, 88, 12',
  MEDIUM:   '202, 138, 4',
  LOW:      '22, 163, 74',
  INFO:     '100, 116, 139',
};

const SEV_SHORT: Record<ThreatSeverity, string> = {
  CRITICAL: 'CRIT', HIGH: 'HIGH', MEDIUM: 'MED', LOW: 'LOW', INFO: 'INFO',
};

const STATUS_BADGE: Record<ThreatStatus, { label: string; cls: string }> = {
  IDENTIFIED:    { label: 'Identified',    cls: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600' },
  IN_PROGRESS:   { label: 'In Progress',   cls: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700' },
  MITIGATED:     { label: 'Mitigated',     cls: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700' },
  ACCEPTED:      { label: 'Accepted',      cls: 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 border-teal-300 dark:border-teal-700' },
  FALSE_POSITIVE:{ label: 'Dismissed',     cls: 'text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
};

const STATUS_OPTIONS: ThreatStatus[] = ['IDENTIFIED', 'IN_PROGRESS', 'MITIGATED', 'ACCEPTED', 'FALSE_POSITIVE'];
const SEVERITY_OPTIONS: ThreatSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── STRIDE Risk Heat Map ──────────────────────────────────────────────────────

interface HeatMapProps {
  threats: ProjectThreat[];
  activeStride: StrideCategory | 'ALL';
  activeSeverity: ThreatSeverity | 'ALL';
  onCellClick: (stride: StrideCategory, sev: ThreatSeverity) => void;
}

function StrideHeatMap({ threats, activeStride, activeSeverity, onCellClick }: HeatMapProps) {
  const matrix = useMemo(() => {
    const counts: Partial<Record<StrideCategory, Partial<Record<ThreatSeverity, number>>>> = {};
    for (const t of threats) {
      if (t.status === 'FALSE_POSITIVE') continue;
      if (!counts[t.strideCategory]) counts[t.strideCategory] = {};
      counts[t.strideCategory]![t.severity] = (counts[t.strideCategory]![t.severity] ?? 0) + 1;
    }
    return counts;
  }, [threats]);

  const maxCount = useMemo(() => {
    let max = 1;
    for (const s of STRIDE_OPTIONS)
      for (const v of SEVERITY_OPTIONS) {
        const c = matrix[s]?.[v] ?? 0;
        if (c > max) max = c;
      }
    return max;
  }, [matrix]);

  const totalShown = useMemo(
    () => threats.filter((t) => t.status !== 'FALSE_POSITIVE').length,
    [threats],
  );

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck size={13} className="text-red-500 flex-shrink-0" />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">STRIDE Risk Matrix</span>
        <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">
          {totalShown} active · click to filter
        </span>
      </div>

      {/* Severity column headers */}
      <div className="mb-1 grid grid-cols-[100px_repeat(5,1fr)] gap-1">
        <div />
        {SEVERITY_OPTIONS.map((sev) => (
          <div key={sev} className={`text-center text-[10px] font-bold uppercase tracking-wide ${
            sev === 'CRITICAL' ? 'text-red-600 dark:text-red-400' :
            sev === 'HIGH'     ? 'text-orange-500 dark:text-orange-400' :
            sev === 'MEDIUM'   ? 'text-yellow-600 dark:text-yellow-400' :
            sev === 'LOW'      ? 'text-green-600 dark:text-green-400' :
                                 'text-slate-500 dark:text-slate-400'
          }`}>
            {SEV_SHORT[sev]}
          </div>
        ))}
      </div>

      {/* STRIDE rows */}
      <div className="flex flex-col gap-1">
        {STRIDE_OPTIONS.map((stride) => (
          <div key={stride} className="grid grid-cols-[100px_repeat(5,1fr)] gap-1 items-center">
            {/* Row label */}
            <div className="truncate pr-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
              {STRIDE_LABEL[stride]}
            </div>
            {/* Cells */}
            {SEVERITY_OPTIONS.map((sev) => {
              const count = matrix[stride]?.[sev] ?? 0;
              const isActive = activeStride === stride && activeSeverity === sev;
              const opacity = count === 0 ? 0 : Math.min(0.12 + (count / maxCount) * 0.78, 0.9);
              const textDark = opacity > 0.45;
              return (
                <button
                  key={sev}
                  disabled={count === 0}
                  onClick={() => onCellClick(stride, sev)}
                  title={count > 0 ? `${count} ${STRIDE_LABEL[stride]} / ${sev}` : undefined}
                  style={count > 0 ? { backgroundColor: `rgba(${SEVERITY_COLOR_RGB[sev]}, ${opacity})` } : undefined}
                  className={`flex h-8 items-center justify-center rounded text-xs font-bold tabular-nums transition-all ${
                    count === 0
                      ? 'cursor-default border border-dashed border-slate-200 text-slate-300 dark:border-slate-700 dark:text-slate-700'
                      : isActive
                        ? 'cursor-pointer shadow ring-2 ring-inset ring-slate-700 dark:ring-slate-200'
                        : 'cursor-pointer hover:ring-2 hover:ring-inset hover:ring-slate-400 hover:shadow'
                  }`}
                >
                  {count > 0
                    ? <span className={textDark ? 'text-white' : 'text-slate-800 dark:text-slate-200'}>{count}</span>
                    : <span>—</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Active filter hint */}
      {(activeStride !== 'ALL' || activeSeverity !== 'ALL') && (
        <p className="mt-3 text-center text-[10px] text-blue-500 dark:text-blue-400">
          Filtering: {activeSeverity !== 'ALL' ? activeSeverity : 'all'} × {activeStride !== 'ALL' ? STRIDE_LABEL[activeStride] : 'all STRIDE'}
          {' · '}
          <button
            onClick={() => { onCellClick(activeStride as StrideCategory, activeSeverity as ThreatSeverity); }}
            className="underline hover:no-underline"
          >
            clear
          </button>
        </p>
      )}
    </div>
  );
}

// ── Threat Detail Sidesheet ───────────────────────────────────────────────────

interface ThreatDetailSheetProps {
  threat: ProjectThreat;
  projectId: string;
  showAcceptanceWarning?: boolean;
  onClose: () => void;
  onUpdate: (updated: ProjectThreat) => void;
  onDelete: (id: string) => void;
}

function ThreatDetailSidesheet({ threat, projectId, showAcceptanceWarning, onClose, onUpdate, onDelete }: ThreatDetailSheetProps) {
  const [pendingNotes, setPendingNotes] = useState(threat.mitigationNotes ?? '');
  const [savingField, setSavingField] = useState<string | null>(null);
  const [notesSaved, setNotesSaved] = useState(false);
  const [acceptanceError, setAcceptanceError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [aiText, setAiText] = useState(threat.mitigationAdvice ?? '');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiCopied, setAiCopied] = useState(false);
  const aiAbortRef = useRef(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Sync when a different row is selected — hydrate from persisted advice.
  useEffect(() => {
    setPendingNotes(threat.mitigationNotes ?? '');
    setAiText(threat.mitigationAdvice ?? '');
    setAiError('');
    setAcceptanceError(false);
    setConfirmDelete(false);
    setNotesSaved(false);
    setAiCopied(false);
    aiAbortRef.current = true;
    setTimeout(() => { aiAbortRef.current = false; }, 50);
  }, [threat.id, threat.mitigationAdvice, threat.mitigationNotes]);

  // When opened via acceptance gate, focus + scroll to notes textarea
  useEffect(() => {
    if (showAcceptanceWarning) {
      setAcceptanceError(true);
      setTimeout(() => {
        notesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        notesRef.current?.focus();
      }, 100);
    }
  }, [showAcceptanceWarning, threat.id]);

  const notesDirty = pendingNotes !== (threat.mitigationNotes ?? '');

  const handleStatusChange = async (newStatus: ThreatStatus) => {
    if (threat.status === newStatus || savingField) return;
    // Feature 3: hard block ACCEPTED without notes
    if (newStatus === 'ACCEPTED' && !pendingNotes.trim()) {
      setAcceptanceError(true);
      notesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      notesRef.current?.focus();
      return;
    }
    setSavingField('status');
    try {
      const updated = await apiUpdateThreat(threat.threatModel.id, threat.id, { status: newStatus });
      onUpdate({ ...threat, ...updated });
      if (newStatus !== 'ACCEPTED') setAcceptanceError(false);
    } finally {
      setSavingField(null);
    }
  };

  const handleSeverityChange = async (newSeverity: ThreatSeverity) => {
    if (threat.severity === newSeverity || savingField) return;
    setSavingField('severity');
    try {
      const updated = await apiUpdateThreat(threat.threatModel.id, threat.id, { severity: newSeverity });
      onUpdate({ ...threat, ...updated });
    } finally {
      setSavingField(null);
    }
  };

  const handleSaveNotes = async () => {
    setSavingField('notes');
    try {
      const updated = await apiUpdateThreat(threat.threatModel.id, threat.id, { mitigationNotes: pendingNotes });
      onUpdate({ ...threat, ...updated });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } finally {
      setSavingField(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await apiDeleteThreat(threat.threatModel.id, threat.id);
      onDelete(threat.id);
    } finally {
      setDeleting(false);
    }
  };

  const handleGetAiAdvice = async () => {
    setAiText('');
    setAiError('');
    setAiLoading(true);
    aiAbortRef.current = false;
    let streamed = '';
    try {
      await apiChatAsk(
        {
          message: `You are a security expert reviewing identified threats for a software system.

Provide specific, actionable mitigation recommendations for this threat:

**Title**: ${threat.title}
**STRIDE Category**: ${STRIDE_FULL_LABEL[threat.strideCategory]}
**Target Component**: ${threat.targetLabel}
**Severity**: ${threat.severity}
**Description**: ${threat.description}

Provide:
1. Concrete implementation controls (specific code patterns, libraries, or configuration steps)
2. How to verify the mitigation is effective
3. Relevant security standard controls this satisfies (e.g., OWASP, ISO 27001 A-controls, SOC2 CC)

Be concise and developer-actionable. Avoid generic advice.`,
          projectId,
        },
        (chunk) => {
          if (aiAbortRef.current) return;
          streamed += chunk;
          setAiText((prev) => prev + chunk);
        },
      );
      if (!aiAbortRef.current && streamed.trim()) {
        try {
          const updated = await apiUpdateThreat(threat.threatModel.id, threat.id, {
            mitigationAdvice: streamed,
          });
          onUpdate({ ...threat, ...updated });
        } catch {
          // Persist failure is non-fatal — the advice is still shown in the UI.
        }
      }
    } catch (e) {
      if (!aiAbortRef.current) setAiError((e as Error).message || 'Failed to get AI advice');
    } finally {
      if (!aiAbortRef.current) setAiLoading(false);
    }
  };

  const handleCopyAdvice = async () => {
    if (!aiText) return;
    try {
      await navigator.clipboard.writeText(aiText);
      setAiCopied(true);
      setTimeout(() => setAiCopied(false), 2000);
    } catch {
      // Clipboard API blocked — silently ignore.
    }
  };

  const isDismissed = threat.status === 'FALSE_POSITIVE';
  const ageInDays = Math.floor((Date.now() - new Date(threat.createdAt).getTime()) / 86_400_000);
  const isStale = threat.status === 'IDENTIFIED' && ageInDays > 0;

  return (
    <div className="fixed right-0 top-9 bottom-0 z-40 flex w-[880px] max-w-[92vw] flex-col border-l border-slate-200 bg-white shadow-[-16px_0_40px_-8px_rgba(15,23,42,0.25)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[-16px_0_40px_-8px_rgba(0,0,0,0.55)] transition-transform">
      {/* Header */}
      <div className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-700">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">{threat.title}</span>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-bold uppercase tracking-wide ${SEVERITY_BADGE[threat.severity]}`}>
              {threat.severity}
            </span>
            <span className={`inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium ${STRIDE_BADGE_CLS[threat.strideCategory]}`}>
              {STRIDE_FULL_LABEL[threat.strideCategory]}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 p-4">

          {/* Target + meta chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">{threat.targetLabel}</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
              threat.identifiedBy === 'AI'
                ? 'text-blue-600 dark:text-blue-300 bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-700'
                : 'text-teal-600 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/40 border-teal-200 dark:border-teal-700'
            }`}>
              {threat.identifiedBy === 'AI' ? <Bot size={9} /> : <User size={9} />}
              {threat.identifiedBy === 'AI' ? 'AI' : 'User'}
            </span>
            {isStale && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                ageInDays > 30
                  ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                  : ageInDays > 14
                    ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
                    : 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600'
              }`} title={`Open for ${ageInDays} days`}>
                <Clock size={9} />
                {ageInDays}d open
              </span>
            )}
          </div>

          {/* Description */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Description</p>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{threat.description}</p>
          </div>

          {/* Status */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  disabled={!!savingField}
                  onClick={() => handleStatusChange(s)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-all ${
                    threat.status === s
                      ? STATUS_BADGE[s].cls + ' ring-1 ring-inset ring-current/40'
                      : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {savingField === 'status' && threat.status === s
                    ? <Loader2 size={11} className="animate-spin inline mr-1" />
                    : null}
                  {STATUS_BADGE[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Severity</p>
            <div className="flex flex-wrap gap-1.5">
              {SEVERITY_OPTIONS.map((s) => (
                <button
                  key={s}
                  disabled={!!savingField}
                  onClick={() => handleSeverityChange(s)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-wide transition-all ${
                    threat.severity === s
                      ? SEVERITY_BADGE[s] + ' ring-1 ring-inset ring-current/40'
                      : 'border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Mitigation Notes */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Mitigation Notes</p>
            {acceptanceError && (
              <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-700/50 dark:bg-amber-900/20">
                <AlertCircle size={13} className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  <span className="font-semibold">Acceptance rationale required.</span> Document why this risk is accepted before changing status to Accepted.
                </p>
              </div>
            )}
            <textarea
              ref={notesRef}
              value={pendingNotes}
              onChange={(e) => { setPendingNotes(e.target.value); setNotesSaved(false); if (e.target.value.trim()) setAcceptanceError(false); }}
              placeholder="Document your mitigation plan, code changes made, or acceptance rationale…"
              rows={4}
              className={`w-full resize-none rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none placeholder-slate-400 focus:ring-1 dark:text-slate-100 dark:placeholder-slate-500 ${
                acceptanceError
                  ? 'border-amber-400 bg-amber-50/30 focus:border-amber-400 focus:ring-amber-300/30 dark:border-amber-600 dark:bg-amber-900/10'
                  : 'border-slate-200 bg-slate-50 focus:border-red-400/50 focus:ring-red-400/30 dark:border-slate-600 dark:bg-slate-800'
              }`}
            />
            {notesDirty && (
              <div className="mt-1.5 flex items-center justify-end gap-2">
                <button
                  onClick={() => setPendingNotes(threat.mitigationNotes ?? '')}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleSaveNotes}
                  disabled={savingField === 'notes'}
                  className="flex items-center gap-1 rounded-lg bg-slate-800 dark:bg-slate-100 px-3 py-1 text-xs font-medium text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-white transition disabled:opacity-50"
                >
                  {savingField === 'notes' ? <Loader2 size={11} className="animate-spin" /> : null}
                  Save Notes
                </button>
              </div>
            )}
            {notesSaved && !notesDirty && (
              <p className="mt-1 text-right text-xs text-green-600 dark:text-green-400">Saved</p>
            )}
          </div>

          {/* AI Mitigation Advice */}
          <div className="rounded-xl border border-indigo-100 dark:border-indigo-800/40 bg-indigo-50/50 dark:bg-indigo-950/30 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-blue-500" />
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">AI Mitigation Advice</p>
              </div>
              <div className="flex items-center gap-1.5">
                {aiText && !aiLoading && (
                  <button
                    onClick={handleCopyAdvice}
                    title={aiCopied ? 'Copied' : 'Copy to clipboard'}
                    className="flex items-center gap-1 rounded-md border border-indigo-200 dark:border-indigo-700/60 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700 transition"
                  >
                    {aiCopied ? <Check size={10} className="text-green-600 dark:text-green-400" /> : <Copy size={10} />}
                    {aiCopied ? 'Copied' : 'Copy'}
                  </button>
                )}
                {aiLoading ? (
                  <span className="flex items-center gap-1 text-[11px] text-blue-500">
                    <Loader2 size={11} className="animate-spin" /> Generating…
                  </span>
                ) : (
                  <button
                    onClick={handleGetAiAdvice}
                    className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-500 transition"
                  >
                    <Sparkles size={10} />
                    {aiText ? 'Regenerate' : 'Get advice'}
                  </button>
                )}
              </div>
            </div>
            {!aiText && !aiLoading && !aiError && (
              <p className="text-xs text-indigo-400/80 dark:text-blue-500/70">
                Ask AI for code-level mitigations, security patterns, and compliance controls for this specific threat.
              </p>
            )}
            {aiError && <p className="text-xs text-red-600 dark:text-red-400">{aiError}</p>}
            {aiText && (
              <div className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mitigationMdComponents}>
                  {aiText}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="rounded-lg border border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/40 p-3 space-y-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center justify-between">
              <span>Model</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[220px] text-right">
                {threat.threatModel.name} · v{threat.threatModel.diagramVersion}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Layer</span>
              <a
                href={`/projects/${projectId}?currLayer=${threat.layerId}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                {threat.layerId.slice(-8)} <ExternalLink size={9} />
              </a>
            </div>
            <div className="flex items-center justify-between">
              <span>Identified</span>
              <span>{formatDate(threat.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Last updated</span>
              <span>{formatDate(threat.updatedAt)}</span>
            </div>
          </div>

        </div>
      </div>

      {/* Footer actions */}
      <div className="flex flex-shrink-0 items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-700">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            confirmDelete
              ? 'bg-red-600 text-white hover:bg-red-500'
              : 'text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-900/20 dark:hover:text-red-400'
          } disabled:opacity-50`}
        >
          {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
          {confirmDelete ? 'Confirm Delete' : 'Delete'}
        </button>
        <button
          onClick={() => handleStatusChange(isDismissed ? 'IDENTIFIED' : 'FALSE_POSITIVE')}
          disabled={!!savingField}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-amber-50 hover:text-amber-600 dark:text-slate-400 dark:hover:bg-amber-900/20 dark:hover:text-amber-400 transition disabled:opacity-50"
        >
          <ShieldOff size={11} />
          {isDismissed ? 'Re-open' : 'Dismiss as False Positive'}
        </button>
      </div>
    </div>
  );
}

// ── Add Threat Modal ──────────────────────────────────────────────────────────

interface AddThreatModalProps {
  projectId: string;
  models: ThreatModelSummary[];
  onClose: () => void;
  onCreated: (threat: ProjectThreat) => void;
}

const EMPTY_ADD = {
  threatModelId: '',
  title: '',
  targetLabel: '',
  description: '',
  strideCategory: 'SPOOFING' as StrideCategory,
  severity: 'MEDIUM' as ThreatSeverity,
};

function AddThreatModal({ models, onClose, onCreated }: AddThreatModalProps) {
  const [form, setForm] = useState({ ...EMPTY_ADD, threatModelId: models[0]?.id ?? '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async () => {
    if (!form.threatModelId || !form.title.trim()) { setErr('Title and model are required.'); return; }
    setSaving(true);
    setErr('');
    try {
      const payload: ThreatItem & { mitigationNotes?: string } = {
        targetId: `user-${Date.now()}`,
        targetType: 'node',
        targetLabel: form.targetLabel || 'General',
        layerId: 'root',
        strideCategory: form.strideCategory,
        title: form.title,
        description: form.description,
        severity: form.severity,
      };
      const created = await apiCreateThreat(form.threatModelId, payload);
      // Wrap as ProjectThreat — model info will be approximated from selection
      const model = models.find((m) => m.id === form.threatModelId);
      const full: ProjectThreat = {
        ...created,
        threatModel: {
          id: form.threatModelId,
          name: model?.name ?? '',
          diagramVersion: model?.diagramVersion ?? 1,
          savedAt: model?.savedAt ?? new Date().toISOString(),
          diagramId: '',
        },
      };
      onCreated(full);
      onClose();
    } catch (e) {
      setErr((e as Error).message || 'Failed to create threat');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-red-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add Threat</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Threat Model *</label>
            <select
              value={form.threatModelId}
              onChange={(e) => setForm((f) => ({ ...f, threatModelId: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name} (v{m.diagramVersion})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Unauthenticated access to admin API"
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none placeholder-slate-400 focus:ring-1 focus:ring-red-400/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Target Component</label>
            <input
              value={form.targetLabel}
              onChange={(e) => setForm((f) => ({ ...f, targetLabel: e.target.value }))}
              placeholder="e.g. AuthService, PostgreSQL"
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none placeholder-slate-400 focus:ring-1 focus:ring-red-400/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">STRIDE</label>
              <select
                value={form.strideCategory}
                onChange={(e) => setForm((f) => ({ ...f, strideCategory: e.target.value as StrideCategory }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                {STRIDE_OPTIONS.map((s) => <option key={s} value={s}>{STRIDE_LABEL[s]}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Severity</label>
              <select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as ThreatSeverity }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the threat…"
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none placeholder-slate-400 focus:ring-1 focus:ring-red-400/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
          {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button onClick={onClose} className="rounded-lg px-4 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.title.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-500 transition disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add Threat
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 10;

interface Props {
  projectId: string;
}

export default function ThreatsDashboardPage({ projectId }: Props) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const storedUser = getStoredUser();

  const [projectName, setProjectName] = useState<string | null>(null);
  const [threatModels, setThreatModels] = useState<ThreatModelSummary[]>([]);
  const [result, setResult] = useState<{ data: ProjectThreat[]; total: number; summary: { totalActive: number; mitigated: number; critical: number; high: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<ThreatSeverity | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<ThreatStatus | 'ALL'>('ALL');
  const [filterStride, setFilterStride] = useState<StrideCategory | 'ALL'>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
  const [selectedThreat, setSelectedThreat] = useState<ProjectThreat | null>(null);
  const [heatMapThreats, setHeatMapThreats] = useState<ProjectThreat[]>([]);
  const [acceptanceRequiredId, setAcceptanceRequiredId] = useState<string | null>(null);

  // Debounce search input by 400ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 0 when filters change
  useEffect(() => { setPage(0); }, [debouncedSearch, filterSeverity, filterStatus, filterStride]);

  // Initial load: project name + threat models (sidebar meta, doesn't change per page)
  useEffect(() => {
    Promise.all([apiListThreatModels(projectId), apiGetProject(projectId)])
      .then(([m, p]) => { setThreatModels(m); setProjectName(p.name); })
      .catch((e) => setError(e.message || 'Failed to load project'));
  }, [projectId]);

  // Fetch all threats once for the heat map (unfiltered, unpaginated)
  useEffect(() => {
    apiListProjectThreats(projectId, { limit: 1000 })
      .then((r) => setHeatMapThreats(r.data))
      .catch(() => {});
  }, [projectId]);

  // Fetch threats from backend whenever page or filters change
  useEffect(() => {
    setTableLoading(true);
    apiListProjectThreats(projectId, {
      page,
      limit: PAGE_LIMIT,
      search: debouncedSearch || undefined,
      severity: filterSeverity !== 'ALL' ? filterSeverity : undefined,
      status: filterStatus !== 'ALL' ? filterStatus : undefined,
      strideCategory: filterStride !== 'ALL' ? filterStride : undefined,
    })
      .then((r) => { setResult(r); setError(null); })
      .catch((e) => setError(e.message || 'Failed to load threats'))
      .finally(() => { setLoading(false); setTableLoading(false); });
  }, [projectId, page, debouncedSearch, filterSeverity, filterStatus, filterStride]);

  const threats = result?.data ?? [];
  const total = result?.total ?? 0;
  const summary = result?.summary;
  const totalPages = Math.ceil(total / PAGE_LIMIT);

  const handleStatusChange = async (t: ProjectThreat, newStatus: ThreatStatus) => {
    // Feature 3: hard block ACCEPTED without mitigation notes
    if (newStatus === 'ACCEPTED' && !t.mitigationNotes?.trim()) {
      setSelectedThreat(t);
      setAcceptanceRequiredId(t.id);
      return;
    }
    setUpdatingId(t.id);
    try {
      await apiUpdateThreat(t.threatModel.id, t.id, { status: newStatus });
      const patch = { ...t, status: newStatus };
      setResult((prev) => prev
        ? { ...prev, data: prev.data.map((x) => x.id === t.id ? patch : x) }
        : prev,
      );
      setSelectedThreat((prev) => prev?.id === t.id ? patch : prev);
      setHeatMapThreats((prev) => prev.map((x) => x.id === t.id ? patch : x));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDismiss = async (t: ProjectThreat) => {
    const newStatus: ThreatStatus = t.status === 'FALSE_POSITIVE' ? 'IDENTIFIED' : 'FALSE_POSITIVE';
    await handleStatusChange(t, newStatus);
  };

  const handleDelete = async (t: ProjectThreat) => {
    setUpdatingId(t.id);
    try {
      await apiDeleteThreat(t.threatModel.id, t.id);
      setResult((prev) => prev
        ? { ...prev, data: prev.data.filter((x) => x.id !== t.id), total: prev.total - 1 }
        : prev,
      );
      setSelectedThreat((prev) => prev?.id === t.id ? null : prev);
      setHeatMapThreats((prev) => prev.filter((x) => x.id !== t.id));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSidesheetUpdate = (updated: ProjectThreat) => {
    setResult((prev) => prev
      ? { ...prev, data: prev.data.map((x) => x.id === updated.id ? updated : x) }
      : prev,
    );
    setSelectedThreat(updated);
    setHeatMapThreats((prev) => prev.map((x) => x.id === updated.id ? updated : x));
  };

  const handleSidesheetDelete = (id: string) => {
    setResult((prev) => prev
      ? { ...prev, data: prev.data.filter((x) => x.id !== id), total: prev.total - 1 }
      : prev,
    );
    setSelectedThreat(null);
    setHeatMapThreats((prev) => prev.filter((x) => x.id !== id));
  };

  const handleHeatMapCellClick = (stride: StrideCategory, sev: ThreatSeverity) => {
    if (filterStride === stride && filterSeverity === sev) {
      setFilterStride('ALL');
      setFilterSeverity('ALL');
    } else {
      setFilterStride(stride);
      setFilterSeverity(sev);
    }
  };

  const cycleTheme = () => {
    const cycle = ['light', 'dark', 'system'] as const;
    setTheme(cycle[(cycle.indexOf(theme) + 1) % cycle.length]);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-gray-950">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="flex h-9 flex-shrink-0 items-center border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="mr-4 flex items-center gap-1.5 pl-1">
          <LayersLogo size={14} className="text-blue-600" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Layers</span>
        </div>

        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="flex items-center gap-1.5 rounded px-3 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <ArrowLeft size={13} />
          Back to diagram
        </button>

        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

        <div className="flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-red-500" />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {projectName ? `${projectName} — Threats` : 'Threats Dashboard'}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {threatModels.length > 0 && (
            <>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <Plus size={12} />
                Add Threat
              </button>
              <button
                onClick={async () => {
                  setExportingReport(true);
                  try { await apiExportThreatReport(projectId); }
                  finally { setExportingReport(false); }
                }}
                disabled={exportingReport}
                className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white disabled:opacity-50"
                title="Export as PDF report"
              >
                {exportingReport
                  ? <><Loader2 size={12} className="animate-spin" /> Generating…</>
                  : <><FileText size={12} /> Export Report</>}
              </button>
            </>
          )}

          <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

          <button
            onClick={cycleTheme}
            title={`Theme: ${theme} — click to cycle`}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            {theme === 'light' ? <Sun size={14} /> : theme === 'dark' ? <Moon size={14} /> : <Monitor size={14} />}
            <span className="hidden sm:inline capitalize">{theme}</span>
          </button>

          <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

          {storedUser && (
            <button
              onClick={() => { signOut(); router.push('/login'); }}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              title="Sign out"
            >
              <User size={13} className="text-slate-500 dark:text-slate-400" />
              <span className="max-w-[140px] truncate text-xs text-slate-500 dark:text-slate-400">
                {storedUser.email}
              </span>
              <LogOut size={12} className="text-slate-400 dark:text-slate-500" />
            </button>
          )}
        </div>
      </header>

      {/* ── Main scrollable area ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-6 py-6 space-y-5">

          {/* Summary cards — from backend summary (always unfiltered totals) */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Total Active', value: summary?.totalActive ?? 0, cls: 'text-slate-900 dark:text-slate-100' },
              { label: 'Mitigated',    value: summary?.mitigated ?? 0,   cls: 'text-green-600 dark:text-green-400' },
              { label: 'Critical',     value: summary?.critical ?? 0,    cls: 'text-red-600 dark:text-red-400' },
              { label: 'High',         value: summary?.high ?? 0,        cls: 'text-orange-600 dark:text-orange-400' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
                <p className={`text-2xl font-bold ${cls}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* STRIDE Risk Matrix — full width */}
          <StrideHeatMap
            threats={heatMapThreats}
            activeStride={filterStride}
            activeSeverity={filterSeverity}
            onCellClick={handleHeatMapCellClick}
          />

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search threats…"
                className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-sm text-slate-900 outline-none placeholder-slate-400 focus:ring-1 focus:ring-red-400/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter size={12} className="text-slate-400 flex-shrink-0" />
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as ThreatSeverity | 'ALL')}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All severities</option>
                {SEVERITY_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as ThreatStatus | 'ALL')}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All statuses</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_BADGE[s].label}</option>)}
              </select>

              <select
                value={filterStride}
                onChange={(e) => setFilterStride(e.target.value as StrideCategory | 'ALL')}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All STRIDE</option>
                {STRIDE_OPTIONS.map((s) => <option key={s} value={s}>{STRIDE_LABEL[s]}</option>)}
              </select>
            </div>

            <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              {tableLoading && <Loader2 size={11} className="animate-spin" />}
              {total} result{total !== 1 ? 's' : ''}
              {totalPages > 1 ? ` · page ${page + 1}/${totalPages}` : ''}
            </span>
          </div>

          {/* Threats Table — full width */}
          <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={24} className="animate-spin text-slate-400" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-400">
              <AlertCircle size={14} /> {error}
            </div>
          ) : total === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <ShieldCheck size={24} className="text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {!result ? 'Loading…' : threatModels.length === 0
                  ? 'No threats saved yet. Run a threat analysis from the diagram view.'
                  : 'No threats match your filters.'}
              </p>
              {threatModels.length === 0 && (
                <button
                  onClick={() => router.push(`/projects/${projectId}`)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white transition dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <ArrowLeft size={13} /> Go to diagram
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 transition-opacity ${tableLoading ? 'opacity-60' : ''}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Threat</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden sm:table-cell">Target</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Severity</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:table-cell">STRIDE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">Layer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden xl:table-cell">Model</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden xl:table-cell">Source</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {threats.map((t) => {
                      const statusInfo = STATUS_BADGE[t.status];
                      const isDismissed = t.status === 'FALSE_POSITIVE';
                      const isSelected = selectedThreat?.id === t.id;
                      return (
                        <tr
                          key={t.id}
                          onClick={() => setSelectedThreat(isSelected ? null : t)}
                          className={`group cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-900/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                          } ${isDismissed ? 'opacity-50' : ''}`}
                        >
                          <td className="max-w-[220px] py-3 pl-3 pr-4">
                            <div className="flex items-start gap-2">
                              <div className={`mt-1 h-3.5 w-0.5 flex-shrink-0 rounded-full transition-colors ${isSelected ? 'bg-blue-500' : 'bg-transparent group-hover:bg-slate-300 dark:group-hover:bg-slate-600'}`} />
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{t.title}</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{t.description}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="text-slate-600 dark:text-slate-300 text-xs">{t.targetLabel}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${SEVERITY_BADGE[t.severity]}`}>
                              {t.severity}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-xs text-slate-500 dark:text-slate-400">{STRIDE_LABEL[t.strideCategory]}</span>
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {updatingId === t.id ? (
                              <Loader2 size={14} className="animate-spin text-slate-400" />
                            ) : (
                              <select
                                value={t.status}
                                onChange={(e) => handleStatusChange(t, e.target.value as ThreatStatus)}
                                className={`rounded-md border px-2 py-0.5 text-xs font-medium outline-none cursor-pointer ${statusInfo.cls}`}
                              >
                                {STATUS_OPTIONS.map((s) => (
                                  <option key={s} value={s}>{STATUS_BADGE[s].label}</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <a
                              href={`/projects/${projectId}?currLayer=${t.layerId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Open layer in diagram: ${t.layerId}`}
                              className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            >
                              {t.layerId.slice(-8)}
                              <ExternalLink size={9} />
                            </a>
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell">
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              <p className="truncate max-w-[130px]">{t.threatModel.name}</p>
                              <p className="text-slate-400 dark:text-slate-500">v{t.threatModel.diagramVersion} · {formatDate(t.threatModel.savedAt)}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                              t.identifiedBy === 'AI'
                                ? 'text-blue-600 dark:text-blue-300 bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-700'
                                : 'text-teal-600 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/40 border-teal-200 dark:border-teal-700'
                            }`}>
                              {t.identifiedBy === 'AI' ? <Bot size={9} /> : <User size={9} />}
                              {t.identifiedBy === 'AI' ? 'AI' : 'User'}
                            </span>
                          </td>
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleDismiss(t)}
                                title={isDismissed ? 'Re-open threat' : 'Dismiss as false positive'}
                                className="rounded p-1 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                              >
                                <ShieldOff size={13} />
                              </button>
                              <button
                                onClick={() => handleDelete(t)}
                                title="Delete threat"
                                className="rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                              <a
                                href={`/projects/${projectId}?threatModel=${t.threatModel.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View in diagram (new tab)"
                                className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              >
                                <ExternalLink size={13} />
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0 || tableLoading}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-white transition disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    ← Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className={`h-7 w-7 rounded-md text-xs font-medium transition ${
                          i === page
                            ? 'bg-red-600 text-white'
                            : 'text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1 || tableLoading}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-white transition disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
          </div>{/* end threats table */}
        </div>
      </div>

      {showAddModal && (
        <AddThreatModal
          projectId={projectId}
          models={threatModels}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setPage(0);
            setShowAddModal(false);
          }}
        />
      )}

      {selectedThreat && (
        <ThreatDetailSidesheet
          threat={selectedThreat}
          projectId={projectId}
          showAcceptanceWarning={acceptanceRequiredId === selectedThreat.id}
          onClose={() => { setSelectedThreat(null); setAcceptanceRequiredId(null); }}
          onUpdate={handleSidesheetUpdate}
          onDelete={handleSidesheetDelete}
        />
      )}
    </div>
  );
}
