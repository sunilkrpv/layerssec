'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, FolderOpen, Loader2, X, GitBranch,
  Clock, ChevronRight, Lock, FileEdit, AlertCircle,
  GitCompare, CheckCircle2, Circle, Pencil, Trash2,
  ArrowRightCircle, BookOpen, Sun, Moon, Monitor, LogOut, Search, User, LayoutDashboard, Activity,
} from 'lucide-react';
import LayersLogo from '@/components/LayersLogo';
import {
  apiListProjects, apiListProjectVersions, apiCheckoutVersion,
  apiCreateProject, apiUpdateProject, apiDeleteProject,
  type ProjectWithVersioning, type DiagramVersion, DraftExistsError,
} from '@/lib/api';
import { isLoggedIn, getStoredUser, clearTokens } from '@/lib/authStore';
import { useTheme } from '@/lib/themeContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROJECT_COLORS = [
  { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-blue-600 dark:text-blue-400' },
  { bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400' },
  { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400' },
  { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400' },
  { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-600 dark:text-rose-400' },
  { bg: 'bg-sky-50 dark:bg-sky-900/20', text: 'text-sky-600 dark:text-sky-400' },
  { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400' },
  { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-400' },
];

function projectColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PROJECT_COLORS[hash % PROJECT_COLORS.length];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ hasDraft, publishedCount }: { hasDraft: boolean; publishedCount: number }) {
  if (hasDraft && publishedCount === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <FileEdit size={9} />
        Draft
      </span>
    );
  }
  if (hasDraft) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <FileEdit size={9} />
        Draft in progress
      </span>
    );
  }
  if (publishedCount > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <Lock size={9} />
        Published
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
      No content
    </span>
  );
}

function latestVersionLabel(p: ProjectWithVersioning): string {
  if (p.publishedCount > 0) return `v${p.publishedCount}`;
  if (p.hasDraft) return 'Draft';
  return '—';
}

// ── Info Panel ─────────────────────────────────────────────────────────────────

const INFO_ITEMS = [
  {
    icon: Lock,
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
    title: 'Published',
    desc: 'A frozen snapshot of your diagram. Shared and read-only — edit by checking out the latest version.',
  },
  {
    icon: FileEdit,
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    title: 'Draft in progress',
    desc: 'Your active working copy. Only one draft allowed per project at a time.',
  },
  {
    icon: GitBranch,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    title: 'Versions',
    desc: 'Each publish creates a numbered version (v1, v2…). You can view, compare, or check out any published version.',
  },
  {
    icon: ArrowRightCircle,
    iconBg: 'bg-indigo-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    title: 'Check Out',
    desc: 'Creates a new draft from the latest published version. Unavailable if a draft already exists.',
  },
];

function InfoPanel() {
  return (
    <aside className="hidden w-64 flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-white px-5 py-6 dark:border-slate-800 dark:bg-slate-900 lg:block">
      <div className="mb-5 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
          <BookOpen size={14} className="text-slate-500 dark:text-slate-400" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Guide
        </span>
      </div>

      <div className="space-y-5">
        {INFO_ITEMS.map(({ icon: Icon, iconBg, iconColor, title, desc }) => (
          <div key={title} className="flex gap-3">
            <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
              <Icon size={13} className={iconColor} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Divider + quick tip */}
      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-3 dark:border-blue-900/40 dark:bg-blue-900/10">
        <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">Tip</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-blue-600 dark:text-blue-400/80">
          Click any project row to open its version history and manage drafts.
        </p>
      </div>
    </aside>
  );
}

// ── New Project Modal ─────────────────────────────────────────────────────────

interface NewProjectModalProps {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

function NewProjectModal({ onClose, onCreate }: NewProjectModalProps) {
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsCreating(true);
    setError(null);
    try {
      await onCreate(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setIsCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm mx-4 rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">New Project</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Project name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Payment Service Architecture"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-600 dark:focus:ring-blue-900/30"
            />
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <AlertCircle size={12} />
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isCreating ? <Loader2 size={13} className="animate-spin" /> : null}
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ─────────────────────────────────────────────────

interface DeleteConfirmModalProps {
  project: ProjectWithVersioning;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
  error: string | null;
}

function DeleteConfirmModal({ project, onConfirm, onCancel, isDeleting, error }: DeleteConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) onCancel(); }}
    >
      <div className="w-full max-w-sm mx-4 rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <Trash2 size={18} className="text-red-600 dark:text-red-400" />
        </div>
        <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">Delete project?</h2>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-800 dark:text-slate-200">{project.name}</span> and all its
          versions, diagrams, and chat history will be permanently deleted.
        </p>

        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
            <AlertCircle size={12} />
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isDeleting ? <Loader2 size={13} className="animate-spin" /> : null}
            Delete Project
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Side-sheet ────────────────────────────────────────────────────────────────

interface SideSheetProps {
  project: ProjectWithVersioning;
  onClose: () => void;
  onNavigate: (projectId: string) => void;
  onView: (projectId: string, diagramId: string) => void;
  onDiff: (projectId: string, v1: DiagramVersion, v2: DiagramVersion) => void;
}

function SideSheet({ project, onClose, onNavigate, onView, onDiff }: SideSheetProps) {
  const [versions, setVersions] = useState<DiagramVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [draftConflictDiagramId, setDraftConflictDiagramId] = useState<string | null>(null);

  const [isDiffMode, setIsDiffMode] = useState(false);
  const [diffSelections, setDiffSelections] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    setVersions([]);
    setCheckoutError(null);
    setDraftConflictDiagramId(null);
    setCheckingOut(null);
    setIsDiffMode(false);
    setDiffSelections([]);
    apiListProjectVersions(project.id)
      .then((v) => setVersions([...v].reverse()))
      .catch(() => setCheckoutError('Failed to load versions'))
      .finally(() => setLoading(false));
  }, [project.id]);

  const handleCheckout = useCallback(async (versionId: string) => {
    setCheckoutError(null);
    setDraftConflictDiagramId(null);
    setCheckingOut(versionId);
    try {
      await apiCheckoutVersion(project.id, versionId);
      onNavigate(project.id);
    } catch (e) {
      if (e instanceof DraftExistsError) {
        setDraftConflictDiagramId(e.existingDraftId);
      } else {
        setCheckoutError(e instanceof Error ? e.message : 'Checkout failed');
      }
    } finally {
      setCheckingOut(null);
    }
  }, [project.id, onNavigate]);

  const handleOpenExistingDraft = useCallback(async () => {
    setDraftConflictDiagramId(null);
    onNavigate(project.id);
  }, [project.id, onNavigate]);

  const toggleDiffSelection = (id: string) => {
    setDiffSelections((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  };

  const handleRunDiff = () => {
    if (diffSelections.length !== 2) return;
    const [id1, id2] = diffSelections;
    const v1 = published.find((v) => v.id === id1);
    const v2 = published.find((v) => v.id === id2);
    if (!v1 || !v2) return;
    const [base, compare] =
      (v1.versionNumber ?? 0) <= (v2.versionNumber ?? 0) ? [v1, v2] : [v2, v1];
    onDiff(project.id, base, compare);
  };

  const draft = versions.find((v) => v.status === 'draft');
  const published = versions.filter((v) => v.status === 'published');
  // After .reverse() on load, published[0] is the newest published version.
  // Check Out is only available on the latest published version when no draft exists.
  const latestPublishedId = published[0]?.id;
  const canDiff = published.length >= 2;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-96 flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div className="min-w-0 flex-1 pr-3">
          <h2 className="truncate text-base font-bold text-slate-900 dark:text-slate-100">{project.name}</h2>
          <p className="mt-0.5 text-xs text-slate-400">Created {formatDate(project.createdAt)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {canDiff && !isDiffMode && (
            <button
              onClick={() => { setIsDiffMode(true); setDiffSelections([]); }}
              title="Compare two versions"
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-blue-700 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
            >
              <GitCompare size={12} />
              Compare
            </button>
          )}
          {isDiffMode && (
            <button
              onClick={() => { setIsDiffMode(false); setDiffSelections([]); }}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Diff mode instruction banner */}
      {isDiffMode && (
        <div className="flex-shrink-0 border-b border-blue-100 bg-blue-50 px-5 py-2.5 dark:border-blue-900 dark:bg-blue-900/10">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Select <strong>2 published versions</strong> to compare.
            {diffSelections.length > 0 && (
              <span className="ml-1 font-medium">{diffSelections.length}/2 selected</span>
            )}
          </p>
        </div>
      )}

      {/* Open draft CTA */}
      {!isDiffMode && project.hasDraft && (
        <div className="flex-shrink-0 border-b border-slate-100 bg-amber-50 px-5 py-3 dark:border-slate-800 dark:bg-amber-900/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <FileEdit size={14} />
              <span>Draft in progress</span>
            </div>
            <button
              onClick={() => onNavigate(project.id)}
              className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
            >
              Open Draft
            </button>
          </div>
        </div>
      )}

      {/* Draft conflict banner */}
      {draftConflictDiagramId && (
        <div className="flex-shrink-0 border-b border-amber-200 bg-amber-50 px-5 py-3 dark:border-amber-900 dark:bg-amber-900/10">
          <p className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-300">
            A draft already exists for this project.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleOpenExistingDraft}
              className="flex-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
            >
              Open existing draft
            </button>
            <button
              onClick={() => { setDraftConflictDiagramId(null); }}
              className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:text-amber-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {checkoutError && (
        <div className="flex-shrink-0 border-b border-red-100 bg-red-50 px-5 py-2.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/10 dark:text-red-400">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={12} />
            {checkoutError}
          </div>
        </div>
      )}

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            Loading versions…
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <GitBranch size={28} className="text-slate-300 dark:text-slate-600" />
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No content yet</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Open the editor to start building your diagram.
              </p>
            </div>
            <button
              onClick={() => onNavigate(project.id)}
              className="mt-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Go to Editor
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {draft && !isDiffMode && (
              <li className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <FileEdit size={9} />
                        Working Draft
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Last saved {formatDate(draft.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => onNavigate(project.id)}
                    className="flex-shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-400"
                  >
                    Open
                  </button>
                </div>
              </li>
            )}

            {published.map((v) => {
              const isSelected = diffSelections.includes(v.id);
              const canSelect = isSelected || diffSelections.length < 2;

              return (
                <li
                  key={v.id}
                  className={`px-5 py-3.5 transition-colors ${
                    isDiffMode
                      ? isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/15'
                        : canSelect
                        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        : 'opacity-40'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <Lock size={9} />
                          v{v.versionNumber}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {v.publishedAt ? formatDate(v.publishedAt) : '—'}
                        </span>
                      </div>
                      {v.publishComment && (
                        <p className="mt-1 truncate text-xs italic text-slate-500 dark:text-slate-400">
                          &ldquo;{v.publishComment}&rdquo;
                        </p>
                      )}
                    </div>

                    {isDiffMode ? (
                      <button
                        onClick={() => canSelect && toggleDiffSelection(v.id)}
                        disabled={!canSelect}
                        className="flex-shrink-0 rounded-lg p-1 transition-colors"
                      >
                        {isSelected ? (
                          <CheckCircle2 size={18} className="text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Circle size={18} className="text-slate-300 dark:text-slate-600" />
                        )}
                      </button>
                    ) : (
                      /* Normal mode — View + Check Out (only for latest published, only when no draft) */
                      <div className="flex flex-shrink-0 flex-col gap-1.5">
                        <button
                          onClick={() => onView(project.id, v.id)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          View
                        </button>
                        {!draft && v.id === latestPublishedId && (
                          <button
                            onClick={() => handleCheckout(v.id)}
                            disabled={!!checkingOut}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-400"
                          >
                            {checkingOut === v.id ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              'Check Out'
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Diff mode footer */}
      {isDiffMode && (
        <div className="flex-shrink-0 border-t border-slate-200 bg-white px-5 py-3.5 dark:border-slate-700 dark:bg-slate-900">
          <button
            disabled={diffSelections.length !== 2}
            onClick={handleRunDiff}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <GitCompare size={14} />
            {diffSelections.length === 2
              ? 'Compare Selected Versions'
              : `Select ${2 - diffSelections.length} more version${diffSelections.length === 0 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProjectsListPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [projects, setProjects] = useState<ProjectWithVersioning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectWithVersioning | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ProjectWithVersioning | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [user, setUser] = useState<{ name?: string | null; email: string } | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/login');
      return;
    }
    const stored = getStoredUser();
    if (stored) setUser({ name: stored.name, email: stored.email });
    apiListProjects()
      .then(setProjects)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load projects'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleCreate = useCallback(async (name: string) => {
    await apiCreateProject(name);
    const updated = await apiListProjects();
    setProjects(updated);
    setShowCreateModal(false);
  }, []);

  const handleNavigate = useCallback((projectId: string) => {
    router.push(`/projects/${projectId}`);
  }, [router]);

  const handleView = useCallback((projectId: string, diagramId: string) => {
    router.push(`/projects/${projectId}?view=${diagramId}`);
  }, [router]);

  const handleDiff = useCallback(
    (projectId: string, base: DiagramVersion, compare: DiagramVersion) => {
      const pc1 = base.publishComment ? encodeURIComponent(base.publishComment) : '';
      const pc2 = compare.publishComment ? encodeURIComponent(compare.publishComment) : '';
      router.push(
        `/diff?projectId=${projectId}&v1=${base.id}&vn1=${base.versionNumber ?? ''}&pc1=${pc1}&v2=${compare.id}&vn2=${compare.versionNumber ?? ''}&pc2=${pc2}`,
      );
    },
    [router],
  );

  // ── Rename ──────────────────────────────────────────────────────────────────

  const handleRenameStart = (p: ProjectWithVersioning, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNameId(p.id);
    setEditingNameValue(p.name);
  };

  const handleRenameSave = async (id: string) => {
    const trimmed = editingNameValue.trim();
    setEditingNameId(null);
    if (!trimmed || trimmed === projects.find((p) => p.id === id)?.name) return;
    try {
      await apiUpdateProject(id, { name: trimmed });
      setProjects((prev) => prev.map((p) => p.id === id ? { ...p, name: trimmed } : p));
      setSelectedProject((prev) => prev?.id === id ? { ...prev, name: trimmed } : prev);
    } catch {
      // Silently revert on failure
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') { e.preventDefault(); handleRenameSave(id); }
    if (e.key === 'Escape') { setEditingNameId(null); }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiDeleteProject(deleteTarget.id);
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      if (selectedProject?.id === deleteTarget.id) setSelectedProject(null);
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* App header — matches MenuBar style */}
      <header className="flex h-9 flex-shrink-0 items-center border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
        {/* Logo */}
        <div className="mr-4 flex items-center gap-1.5 pl-1">
          <LayersLogo size={14} className="text-blue-600" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Layers</span>
        </div>

        {/* Dashboard link */}
        <button
          onClick={() => router.push('/home')}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          title="Back to Home"
        >
          <LayoutDashboard size={13} />
          <span className="hidden sm:inline">Home</span>
        </button>
        <button
          onClick={() => router.push('/activity')}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          title="AI Activity"
        >
          <Activity size={13} />
          <span className="hidden sm:inline">AI Activity</span>
        </button>
        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

        {/* Right side — theme toggle + user */}
        <div className="ml-auto flex items-center gap-1">
          {/* Theme cycle */}
          <button
            onClick={() => {
              const cycle = ['light', 'dark', 'system'] as const;
              setTheme(cycle[(cycle.indexOf(theme) + 1) % cycle.length]);
            }}
            title={`Theme: ${theme} — click to cycle`}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            {theme === 'light' ? <Sun size={14} /> : theme === 'dark' ? <Moon size={14} /> : <Monitor size={14} />}
            <span className="hidden sm:inline capitalize">{theme}</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

          {/* User + sign out */}
          {user && (
            <button
              onClick={() => { clearTokens(); router.push('/login'); }}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              title="Sign out"
            >
              <User size={13} className="text-slate-500 dark:text-slate-400" />
              <span className="max-w-[140px] truncate text-xs text-slate-500 dark:text-slate-400">
                {user.email}
              </span>
              <LogOut size={12} className="text-slate-400 dark:text-slate-500" />
            </button>
          )}
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="flex-shrink-0 border-b border-red-100 bg-red-50 px-5 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/10 dark:text-red-400">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={14} />
            {error}
          </div>
        </div>
      )}

      {/* Body — info panel + content */}
      <div className="flex flex-1 overflow-hidden">
        <InfoPanel />

        <main className="flex flex-col flex-1 overflow-auto">
          {/* Sub-header: page title + New Project */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
            <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100">My Projects</h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={13} />
              New Project
            </button>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              Loading…
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <FolderOpen size={40} className="text-slate-300 dark:text-slate-700" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No projects yet.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-2 flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus size={14} />
                Create your first project
              </button>
            </div>
          ) : (
            <div className="px-5 py-5">
              {/* Search + filter bar */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search projects…"
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-600 dark:focus:ring-indigo-900/30"
                  />
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
                  {(['all', 'draft', 'published'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setStatusFilter(f)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                        statusFilter === f
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Name
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Created
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Last updated
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Latest
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Status
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {projects
                      .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .filter((p) => {
                        if (statusFilter === 'draft') return p.hasDraft;
                        if (statusFilter === 'published') return !p.hasDraft && p.publishedCount > 0;
                        return true;
                      })
                      .map((p) => (
                      <tr
                        key={p.id}
                        className={`group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                          selectedProject?.id === p.id ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''
                        }`}
                        onClick={() => {
                          if (editingNameId === p.id) return;
                          setSelectedProject(p);
                        }}
                      >
                        {/* Name */}
                        <td className="px-4 py-3" onClick={(e) => editingNameId === p.id && e.stopPropagation()}>
                          <div className="flex items-center gap-2.5">
                            <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${projectColor(p.id).bg} ${projectColor(p.id).text}`}>
                              <FolderOpen size={14} />
                            </div>
                            {editingNameId === p.id ? (
                              <input
                                autoFocus
                                value={editingNameValue}
                                onChange={(e) => setEditingNameValue(e.target.value)}
                                onBlur={() => handleRenameSave(p.id)}
                                onKeyDown={(e) => handleRenameKeyDown(e, p.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-40 rounded-lg border border-blue-400 bg-white px-2 py-0.5 text-sm font-medium text-slate-800 outline-none ring-2 ring-blue-100 dark:border-blue-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-blue-900/40"
                              />
                            ) : (
                              <span className="font-medium text-slate-800 dark:text-slate-200">{p.name}</span>
                            )}
                          </div>
                        </td>

                        {/* Created */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <Clock size={11} />
                            {formatDate(p.createdAt)}
                          </div>
                        </td>

                        {/* Last updated */}
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {formatDate(p.updatedAt)}
                          </span>
                        </td>

                        {/* Latest version */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {latestVersionLabel(p)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge hasDraft={p.hasDraft} publishedCount={p.publishedCount} />
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            {/* Rename */}
                            <button
                              title="Rename project"
                              onClick={(e) => handleRenameStart(p, e)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                            >
                              <Pencil size={13} />
                            </button>
                            {/* Delete */}
                            <button
                              title="Delete project"
                              onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeleteTarget(p); }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                            >
                              <Trash2 size={13} />
                            </button>
                            {/* Open chevron */}
                            <ChevronRight size={14} className="ml-1 text-slate-300 dark:text-slate-600" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

      </div>

      {/* Modals */}
      {showCreateModal && (
        <NewProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          project={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => { if (!isDeleting) setDeleteTarget(null); }}
          isDeleting={isDeleting}
          error={deleteError}
        />
      )}

      {/* Side sheet overlay */}
      {selectedProject && (
        <>
          <div
            className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-[1px]"
            onClick={() => setSelectedProject(null)}
          />
          <SideSheet
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
            onNavigate={handleNavigate}
            onView={handleView}
            onDiff={handleDiff}
          />
        </>
      )}
    </div>
  );
}
