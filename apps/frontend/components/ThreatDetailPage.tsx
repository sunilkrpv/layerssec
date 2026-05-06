'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, AlertCircle, ShieldCheck, Sparkles, Copy, Check,
  Sun, Moon, Monitor, LogOut, User, Trash2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import LayersLogo from '@/components/LayersLogo';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  apiGetThreat, apiUpdateThreat, apiDeleteThreat, apiChatAsk,
  type ProjectThreat, type ThreatStatus, type StrideCategory,
} from '@/lib/api';
import { STRIDE_FULL_LABEL, formatThreatDate } from '@/lib/threatBadges';
import { getStoredUser, signOut } from '@/lib/authStore';
import { useTheme } from '@/lib/themeContext';

interface Props { projectId: string; threatId: string }

// Markdown renderers for the AI Mitigation Advice section — code blocks get a
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
    <blockquote className="mb-2 border-l-2 border-indigo-300 pl-3 italic text-slate-600 dark:border-indigo-700 dark:text-slate-400">
      {children}
    </blockquote>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold dark:border-slate-700 dark:bg-slate-800/60">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-slate-200 px-2 py-1 align-top dark:border-slate-700">{children}</td>
  ),
};

export default function ThreatDetailPage({ projectId, threatId }: Props) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const cycleTheme = () => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light');
  const storedUser = getStoredUser();

  const [threat, setThreat] = useState<ProjectThreat | null>(null);
  const [loadError, setLoadError] = useState<'404' | 'network' | null>(null);
  const [pendingNotes, setPendingNotes] = useState('');
  const [savingField, setSavingField] = useState<string | null>(null);
  const [notesSaved, setNotesSaved] = useState(false);
  const [acceptanceError, setAcceptanceError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiCopied, setAiCopied] = useState(false);
  const aiAbortRef = useRef(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Load on mount / when threatId changes
  useEffect(() => {
    setLoadError(null);
    apiGetThreat(projectId, threatId)
      .then((t) => {
        setThreat(t);
        setPendingNotes(t.mitigationNotes ?? '');
        setAiText(t.mitigationAdvice ?? '');
      })
      .catch((e) => {
        const msg = (e as Error).message ?? '';
        if (/\b404\b/.test(msg)) setLoadError('404');
        else setLoadError('network');
      });
  }, [projectId, threatId]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleStatusChange = async (newStatus: ThreatStatus) => {
    if (!threat || threat.status === newStatus || savingField) return;
    // Hard block: ACCEPTED requires mitigation notes
    if (newStatus === 'ACCEPTED' && !pendingNotes.trim()) {
      setAcceptanceError(true);
      notesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      notesRef.current?.focus();
      return;
    }
    setSavingField('status');
    try {
      const updated = await apiUpdateThreat(threat.threatModel.id, threat.id, { status: newStatus });
      setThreat({ ...threat, ...updated });
      if (newStatus !== 'ACCEPTED') setAcceptanceError(false);
    } finally {
      setSavingField(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!threat) return;
    setSavingField('notes');
    try {
      const updated = await apiUpdateThreat(threat.threatModel.id, threat.id, { mitigationNotes: pendingNotes });
      setThreat({ ...threat, ...updated });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } finally {
      setSavingField(null);
    }
  };

  const handleDelete = async () => {
    if (!threat) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await apiDeleteThreat(threat.threatModel.id, threat.id);
      router.push(`/projects/${projectId}/threats`);
    } finally {
      setDeleting(false);
    }
  };

  const handleGetAiAdvice = async () => {
    if (!threat) return;
    setAiText('');
    setAiError('');
    setAiLoading(true);
    aiAbortRef.current = false;
    let streamed = '';
    try {
      await apiChatAsk(
        {
          message: `You are a security expert reviewing identified threats for a software system.\n\nProvide specific, actionable mitigation recommendations for this threat:\n\n**Title**: ${threat.title}\n**STRIDE Category**: ${STRIDE_FULL_LABEL[threat.strideCategory]}\n**Target Component**: ${threat.targetLabel}\n**Severity**: ${threat.severity}\n**Description**: ${threat.description}\n\nProvide:\n1. Concrete implementation controls (specific code patterns, libraries, or configuration steps)\n2. How to verify the mitigation is effective\n3. Relevant security standard controls this satisfies (e.g., OWASP, ISO 27001 A-controls, SOC2 CC)\n\nBe concise and developer-actionable. Avoid generic advice.`,
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
          const updated = await apiUpdateThreat(threat.threatModel.id, threat.id, { mitigationAdvice: streamed });
          setThreat({ ...threat, ...updated });
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

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loadError === '404') {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-gray-950">
        <DetailTopBar
          projectId={projectId}
          title="Threat not found"
          router={router}
          theme={theme}
          cycleTheme={cycleTheme}
          storedUser={storedUser}
        />
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-2xl px-6 py-16">
            <EmptyState
              icon={<AlertCircle size={28} />}
              heading="Threat not found"
              subtext="This threat may have been deleted or moved."
              cta={
                <Button onClick={() => router.push(`/projects/${projectId}/threats`)}>
                  <ArrowLeft size={13} /> Back to threats
                </Button>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  if (loadError === 'network') {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-gray-950">
        <DetailTopBar
          projectId={projectId}
          title="Failed to load threat"
          router={router}
          theme={theme}
          cycleTheme={cycleTheme}
          storedUser={storedUser}
        />
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-2xl px-6 py-16">
            <EmptyState
              icon={<AlertCircle size={28} />}
              heading="Failed to load threat"
              subtext="Check your connection and try again."
              cta={
                <Button onClick={() => { setLoadError(null); window.location.reload(); }}>
                  Retry
                </Button>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  if (!threat) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 size={28} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-gray-950">
      <DetailTopBar
        projectId={projectId}
        title={threat.title}
        router={router}
        theme={theme}
        cycleTheme={cycleTheme}
        storedUser={storedUser}
        onDelete={handleDelete}
        confirmDelete={confirmDelete}
        deleting={deleting}
        onCancelDelete={() => setConfirmDelete(false)}
      />

      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">

          {/* Pill row */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill variant="severity" value={threat.severity.toLowerCase() as 'critical' | 'high' | 'medium' | 'low' | 'info'} />
            <StatusPill variant="stride" value={mapStride(threat.strideCategory)} />
            <StatusPill variant="source" value={threat.identifiedBy === 'AI' ? 'ai' : 'user'} />
            <StatusPill variant="status" value={mapStatus(threat.status)} />
          </div>

          {/* Title + description */}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{threat.title}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{threat.description}</p>
            {threat.status === 'ACCEPTED' && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/30 dark:text-amber-200">
                <AlertCircle size={12} /> Accepted — requires mitigation notes for audit
              </div>
            )}
          </div>

          {/* Target */}
          <Section title="Target">
            <span className="font-mono text-sm text-slate-700 dark:text-slate-300">{threat.targetLabel}</span>
          </Section>

          {/* Status changer */}
          <Section title="Status">
            <div className="flex flex-wrap gap-2">
              {(['IDENTIFIED', 'IN_PROGRESS', 'MITIGATED', 'ACCEPTED', 'FALSE_POSITIVE'] as ThreatStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={savingField === 'status' || s === threat.status}
                  onClick={() => handleStatusChange(s)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    s === threat.status
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                  } disabled:opacity-50`}
                >
                  {savingField === 'status' && s === threat.status
                    ? <Loader2 size={11} className="inline animate-spin mr-1" />
                    : null}
                  {s.replace(/_/g, ' ').toLowerCase()}
                </button>
              ))}
            </div>
            {acceptanceError && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Add mitigation notes before accepting this threat.
              </p>
            )}
          </Section>

          {/* Mitigation notes */}
          <Section title="Mitigation notes">
            {acceptanceError && (
              <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-700/50 dark:bg-amber-900/20">
                <AlertCircle size={13} className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  <span className="font-semibold">Acceptance rationale required.</span>{' '}
                  Document why this risk is accepted before changing status to Accepted.
                </p>
              </div>
            )}
            <textarea
              ref={notesRef}
              value={pendingNotes}
              onChange={(e) => {
                setPendingNotes(e.target.value);
                setNotesSaved(false);
                if (e.target.value.trim()) setAcceptanceError(false);
              }}
              placeholder="Document your mitigation plan, code changes made, or acceptance rationale…"
              className={`w-full rounded-lg border bg-white p-3 text-sm text-slate-900 outline-none placeholder-slate-400 focus:ring-1 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 ${
                acceptanceError
                  ? 'border-amber-400 bg-amber-50/30 focus:border-amber-400 focus:ring-amber-300/30 dark:border-amber-600 dark:bg-amber-900/10'
                  : 'border-slate-200 focus:border-blue-400 focus:ring-blue-400/20 dark:border-slate-700'
              }`}
              rows={6}
            />
            {pendingNotes !== (threat.mitigationNotes ?? '') && (
              <div className="mt-2 flex items-center gap-2">
                <Button onClick={handleSaveNotes} disabled={savingField === 'notes'}>
                  {savingField === 'notes' ? <Loader2 size={13} className="animate-spin" /> : null}
                  Save Notes
                </Button>
                <Button variant="secondary" onClick={() => setPendingNotes(threat.mitigationNotes ?? '')}>
                  Discard
                </Button>
                {notesSaved && <span className="text-xs text-green-600 dark:text-green-400">Saved</span>}
              </div>
            )}
          </Section>

          {/* AI Mitigation Advice */}
          <Section
            title="AI Mitigation Advice"
            actions={
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={handleGetAiAdvice} disabled={aiLoading}>
                  {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {aiText ? 'Regenerate' : 'Get advice'}
                </Button>
                {aiText && !aiLoading && (
                  <Button variant="secondary" onClick={handleCopyAdvice}>
                    {aiCopied ? <Check size={13} /> : <Copy size={13} />}
                    {aiCopied ? 'Copied' : 'Copy'}
                  </Button>
                )}
              </div>
            }
          >
            {aiError && <div className="text-sm text-red-600 dark:text-red-400">{aiError}</div>}
            {aiText ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mitigationMdComponents}>
                  {aiText}
                </ReactMarkdown>
              </div>
            ) : !aiLoading && !aiError && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ask AI for code-level mitigations, security patterns, and compliance controls for this specific threat.
              </p>
            )}
          </Section>

          {/* Metadata */}
          <Section title="Metadata">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-slate-100 bg-white p-4 text-xs text-slate-600 dark:border-slate-700/50 dark:bg-slate-800/40 dark:text-slate-400">
              <Meta label="Source" value={threat.identifiedBy === 'AI' ? 'AI' : 'User'} />
              <Meta label="Identified" value={formatThreatDate(threat.createdAt)} />
              <Meta label="Last updated" value={formatThreatDate(threat.updatedAt)} />
              <Meta label="Threat Model" value={`${threat.threatModel.name} · v${threat.threatModel.diagramVersion}`} />
              <Meta label="Layer ID" value={threat.layerId.slice(-8)} />
            </dl>
          </Section>

        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-medium text-slate-500 dark:text-slate-500">{label}</dt>
      <dd className="text-slate-700 dark:text-slate-300">{value}</dd>
    </>
  );
}

interface DetailTopBarProps {
  projectId: string;
  title: string;
  router: ReturnType<typeof useRouter>;
  theme: string;
  cycleTheme: () => void;
  storedUser: ReturnType<typeof getStoredUser>;
  onDelete?: () => void;
  confirmDelete?: boolean;
  deleting?: boolean;
  onCancelDelete?: () => void;
}

function DetailTopBar({
  projectId,
  title,
  router,
  theme,
  cycleTheme,
  storedUser,
  onDelete,
  confirmDelete,
  deleting,
  onCancelDelete,
}: DetailTopBarProps) {
  return (
    <header className="flex h-9 flex-shrink-0 items-center border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
      {/* Logo */}
      <div className="mr-4 flex items-center gap-1.5 pl-1">
        <LayersLogo size={14} className="text-blue-600" />
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Layers</span>
      </div>

      {/* Back button */}
      <button
        onClick={() => router.push(`/projects/${projectId}/threats`)}
        className="flex items-center gap-1.5 rounded px-3 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
      >
        <ArrowLeft size={13} />
        Back to threats
      </button>

      <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

      {/* Page context */}
      <div className="flex min-w-0 items-center gap-1.5">
        <ShieldCheck size={12} className="flex-shrink-0 text-red-500" />
        <span
          className="truncate text-sm text-slate-600 dark:text-slate-300"
          title={title}
        >
          {title}
        </span>
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-1">
        {/* Delete button (two-click confirm) */}
        {onDelete && (
          <>
            {confirmDelete && (
              <button
                onClick={onCancelDelete}
                className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
            )}
            <button
              onClick={onDelete}
              disabled={deleting}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs disabled:opacity-50 ${
                confirmDelete
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
              }`}
              title={confirmDelete ? 'Click again to confirm deletion' : 'Delete this threat'}
            >
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              {confirmDelete ? 'Confirm delete' : 'Delete'}
            </button>
          </>
        )}

        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

        {/* Theme cycle */}
        <button
          onClick={cycleTheme}
          title={`Theme: ${theme} — click to cycle`}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          {theme === 'light' ? <Sun size={14} /> : theme === 'dark' ? <Moon size={14} /> : <Monitor size={14} />}
        </button>

        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

        {/* User + sign out */}
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
  );
}

// ── Mapping helpers ───────────────────────────────────────────────────────────

function mapStride(s: StrideCategory): 'spoofing' | 'tampering' | 'repudiation' | 'info-disclosure' | 'dos' | 'elevation' {
  switch (s) {
    case 'SPOOFING':               return 'spoofing';
    case 'TAMPERING':              return 'tampering';
    case 'REPUDIATION':            return 'repudiation';
    case 'INFORMATION_DISCLOSURE': return 'info-disclosure';
    case 'DENIAL_OF_SERVICE':      return 'dos';
    case 'ELEVATION_OF_PRIVILEGE': return 'elevation';
  }
}

function mapStatus(s: ThreatStatus): 'open' | 'in-review' | 'mitigated' | 'accepted' | 'dismissed' {
  switch (s) {
    case 'IDENTIFIED':    return 'open';
    case 'IN_PROGRESS':   return 'in-review';
    case 'MITIGATED':     return 'mitigated';
    case 'ACCEPTED':      return 'accepted';
    case 'FALSE_POSITIVE': return 'dismissed';
  }
}
