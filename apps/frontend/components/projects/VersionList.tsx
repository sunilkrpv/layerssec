'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Circle, FileEdit, GitBranch, GitCompare, Loader2, Lock,
} from 'lucide-react';
import {
  apiCheckoutVersion, apiListProjectVersions,
  DraftExistsError, type DiagramVersion,
} from '@/lib/api';
import { formatRelativeDate } from '@/lib/projectBadges';

export interface VersionListProps {
  projectId: string;
  hasDraft: boolean;
  onNavigate: (projectId: string) => void;
  onView: (projectId: string, diagramId: string) => void;
  onDiff: (projectId: string, base: DiagramVersion, compare: DiagramVersion) => void;
  /** External signal to enter diff mode (driven by side-sheet "Compare" button). */
  isDiffMode: boolean;
  onExitDiffMode: () => void;
}

export function VersionList({
  projectId, hasDraft, onNavigate, onView, onDiff, isDiffMode, onExitDiffMode,
}: VersionListProps) {
  const [versions, setVersions] = useState<DiagramVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [diffSelections, setDiffSelections] = useState<string[]>([]);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [draftConflictDiagramId, setDraftConflictDiagramId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setVersions([]);
    setCheckoutError(null);
    setDraftConflictDiagramId(null);
    setCheckingOut(null);
    setDiffSelections([]);
    apiListProjectVersions(projectId)
      .then((v) => setVersions([...v].reverse()))
      .catch(() => setCheckoutError('Failed to load versions'))
      .finally(() => setLoading(false));
  }, [projectId]);

  // Reset selections when diff mode toggles off externally
  useEffect(() => {
    if (!isDiffMode) setDiffSelections([]);
  }, [isDiffMode]);

  const handleCheckout = useCallback(async (versionId: string) => {
    setCheckoutError(null);
    setDraftConflictDiagramId(null);
    setCheckingOut(versionId);
    try {
      await apiCheckoutVersion(projectId, versionId);
      onNavigate(projectId);
    } catch (e) {
      if (e instanceof DraftExistsError) {
        setDraftConflictDiagramId(e.existingDraftId);
      } else {
        setCheckoutError(e instanceof Error ? e.message : 'Checkout failed');
      }
    } finally {
      setCheckingOut(null);
    }
  }, [projectId, onNavigate]);

  const toggleDiffSelection = (id: string) => {
    setDiffSelections((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  };

  const draft = versions.find((v) => v.status === 'draft');
  const published = versions.filter((v) => v.status === 'published');
  // After .reverse() on load, published[0] is the newest published version.
  // Check Out is only available on the latest published version when no draft exists.
  const latestPublishedId = published[0]?.id;

  const handleRunDiff = () => {
    if (diffSelections.length !== 2) return;
    const [id1, id2] = diffSelections;
    const v1 = published.find((v) => v.id === id1);
    const v2 = published.find((v) => v.id === id2);
    if (!v1 || !v2) return;
    const [base, compare] =
      (v1.versionNumber ?? 0) <= (v2.versionNumber ?? 0) ? [v1, v2] : [v2, v1];
    onDiff(projectId, base, compare);
  };

  return (
    <div className="flex flex-col">
      {/* Diff mode instruction banner */}
      {isDiffMode && (
        <div className="border-y border-blue-100 bg-blue-50 px-5 py-2.5 dark:border-blue-900 dark:bg-blue-900/10">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Select <strong>2 published versions</strong> to compare.
            {diffSelections.length > 0 && (
              <span className="ml-1 font-medium">{diffSelections.length}/2 selected</span>
            )}
          </p>
        </div>
      )}

      {/* Open draft CTA */}
      {!isDiffMode && hasDraft && draft && (
        <div className="border-y border-slate-100 bg-amber-50 px-5 py-3 dark:border-slate-800 dark:bg-amber-900/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <FileEdit size={14} />
              <span>Draft in progress</span>
            </div>
            <button
              onClick={() => onNavigate(projectId)}
              className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
            >
              Open Draft
            </button>
          </div>
        </div>
      )}

      {/* Draft conflict banner */}
      {draftConflictDiagramId && (
        <div className="border-y border-amber-200 bg-amber-50 px-5 py-3 dark:border-amber-900 dark:bg-amber-900/10">
          <p className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-300">
            A draft already exists for this project.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { setDraftConflictDiagramId(null); onNavigate(projectId); }}
              className="flex-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
            >
              Open existing draft
            </button>
            <button
              onClick={() => setDraftConflictDiagramId(null)}
              className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:text-amber-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {checkoutError && (
        <div className="border-y border-red-100 bg-red-50 px-5 py-2.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/10 dark:text-red-400">
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
              onClick={() => onNavigate(projectId)}
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
                      Last saved {formatRelativeDate(draft.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => onNavigate(projectId)}
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
                          {v.publishedAt ? formatRelativeDate(v.publishedAt) : '—'}
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
                          onClick={() => onView(projectId, v.id)}
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
        <div className="border-t border-slate-200 bg-white px-5 py-3.5 dark:border-slate-700 dark:bg-slate-900">
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
          <button
            onClick={onExitDiffMode}
            className="mt-2 w-full rounded-lg px-3 py-1 text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Cancel compare
          </button>
        </div>
      )}
    </div>
  );
}
