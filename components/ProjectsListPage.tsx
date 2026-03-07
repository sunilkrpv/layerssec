'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, FolderOpen, Loader2, X, GitBranch,
  Clock, ChevronRight, Lock, FileEdit, AlertCircle,
  GitCompare, CheckCircle2, Circle,
} from 'lucide-react';
import {
  apiListProjects, apiListProjectVersions, apiCheckoutVersion,
  apiGetProjectDraft, apiCreateProject,
  type ProjectWithVersioning, type DiagramVersion, DraftExistsError,
} from '@/lib/api';
import { isLoggedIn } from '@/lib/authStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  const [draftConflictFromVersion, setDraftConflictFromVersion] = useState<string | null>(null);

  // Diff mode state
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
    setDraftConflictFromVersion(null);
    setCheckingOut(versionId);
    try {
      await apiCheckoutVersion(project.id, versionId);
      onNavigate(project.id);
    } catch (e) {
      if (e instanceof DraftExistsError) {
        setDraftConflictDiagramId(e.existingDraftId);
        setDraftConflictFromVersion(versionId);
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
      if (prev.length >= 2) return prev; // already 2 selected — ignore
      return [...prev, id];
    });
  };

  const handleRunDiff = () => {
    if (diffSelections.length !== 2) return;
    const [id1, id2] = diffSelections;
    const v1 = published.find((v) => v.id === id1);
    const v2 = published.find((v) => v.id === id2);
    if (!v1 || !v2) return;
    // Sort so the lower version number is always the "base" (left side)
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
          {/* Compare versions toggle — only when 2+ published versions exist */}
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

      {/* Open draft CTA — hidden in diff mode */}
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
              onClick={() => { setDraftConflictDiagramId(null); setDraftConflictFromVersion(null); }}
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
            {/* Draft entry — hidden in diff mode (can't diff draft) */}
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

            {/* Published entries */}
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
                      /* Diff selection toggle */
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

      {/* Diff mode footer — Compare button */}
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
  const [projects, setProjects] = useState<ProjectWithVersioning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectWithVersioning | null>(null);

  // Create new project
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/projects/local');
      return;
    }
    apiListProjects()
      .then(setProjects)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load projects'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setIsCreating(true);
    setError(null);
    try {
      await apiCreateProject(trimmed);
      const updated = await apiListProjects();
      setProjects(updated);
      setNewName('');
      setShowCreate(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  const handleNavigate = useCallback((projectId: string) => {
    router.push(`/projects/${projectId}`);
  }, [router]);

  const handleView = useCallback((projectId: string, diagramId: string) => {
    router.push(`/projects/${projectId}?view=${diagramId}`);
  }, [router]);

  /** Navigate to the diff page for two specific published versions of a project. */
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

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/projects/local')}
            className="flex items-center gap-1.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">My Projects</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={14} />
          New Project
        </button>
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

      {/* Create project inline form */}
      {showCreate && (
        <div className="flex-shrink-0 border-b border-blue-100 bg-blue-50 px-5 py-3 dark:border-blue-900 dark:bg-blue-900/10">
          <form onSubmit={handleCreate} className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Project name"
              autoFocus
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
            <button
              type="submit"
              disabled={isCreating || !newName.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isCreating ? <Loader2 size={13} className="animate-spin" /> : null}
              Create
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setNewName(''); }}
              className="rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-white dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            Loading…
          </div>
        ) : projects.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <FolderOpen size={40} className="text-slate-300 dark:text-slate-700" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No projects yet.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-2 flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={14} />
              Create your first project
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl px-5 py-6">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="pb-2.5 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Name
                  </th>
                  <th className="pb-2.5 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Created
                  </th>
                  <th className="pb-2.5 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Latest version
                  </th>
                  <th className="pb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Status
                  </th>
                  <th className="pb-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    className={`cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/50 ${
                      selectedProject?.id === p.id ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                    }`}
                    onClick={() => setSelectedProject(p)}
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                          <FolderOpen size={14} />
                        </div>
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">{p.name}</span>
                          {p.description && (
                            <p className="max-w-[180px] truncate text-xs text-slate-400 dark:text-slate-500">
                              {p.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1">
                        <Clock size={11} />
                        {formatDate(p.createdAt)}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {latestVersionLabel(p)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge hasDraft={p.hasDraft} publishedCount={p.publishedCount} />
                    </td>
                    <td className="py-3">
                      <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

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
