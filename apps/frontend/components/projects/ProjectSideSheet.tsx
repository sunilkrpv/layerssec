'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle, GitCompare, Loader2, Pencil, Trash2, X,
} from 'lucide-react';
import {
  apiUpdateProject,
  type ProjectWithVersioning, type DiagramVersion,
} from '@/lib/api';
import { formatRelativeDate } from '@/lib/projectBadges';
import { VersionList } from '@/components/projects/VersionList';

export interface ProjectSideSheetProps {
  project: ProjectWithVersioning;
  onClose: () => void;
  onNavigate: (projectId: string) => void;
  onView: (projectId: string, diagramId: string) => void;
  onDiff: (projectId: string, base: DiagramVersion, compare: DiagramVersion) => void;
  /** Bubbles a saved-rename / saved-description back to the page so the table updates. */
  onProjectChanged: (next: ProjectWithVersioning) => void;
  /** Asks the page to open the delete confirm modal for this project. */
  onRequestDelete: (project: ProjectWithVersioning) => void;
}

export function ProjectSideSheet({
  project, onClose, onNavigate, onView, onDiff, onProjectChanged, onRequestDelete,
}: ProjectSideSheetProps) {
  const [editingName, setEditingName] = useState(false);
  const [pendingName, setPendingName] = useState(project.name);
  const [editingDescription, setEditingDescription] = useState(false);
  const [pendingDescription, setPendingDescription] = useState(project.description ?? '');
  const [savingField, setSavingField] = useState<'name' | 'description' | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDiffMode, setIsDiffMode] = useState(false);

  // Sync local edit buffers when a different project is selected.
  useEffect(() => {
    setEditingName(false);
    setEditingDescription(false);
    setPendingName(project.name);
    setPendingDescription(project.description ?? '');
    setSaveError(null);
    setIsDiffMode(false);
  }, [project.id, project.name, project.description]);

  const handleSaveName = async () => {
    const trimmed = pendingName.trim();
    if (!trimmed || trimmed === project.name) {
      setEditingName(false);
      setPendingName(project.name);
      return;
    }
    setSavingField('name');
    setSaveError(null);
    try {
      const updated = await apiUpdateProject(project.id, { name: trimmed });
      onProjectChanged({ ...project, name: updated.name });
      setEditingName(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save name');
      setPendingName(project.name);
    } finally {
      setSavingField(null);
    }
  };

  const handleSaveDescription = async () => {
    const next = pendingDescription;
    if (next === (project.description ?? '')) {
      setEditingDescription(false);
      return;
    }
    setSavingField('description');
    setSaveError(null);
    try {
      const updated = await apiUpdateProject(project.id, { description: next });
      onProjectChanged({ ...project, description: updated.description });
      setEditingDescription(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save description');
      setPendingDescription(project.description ?? '');
    } finally {
      setSavingField(null);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-96 flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div className="min-w-0 flex-1 pr-3">
          {editingName ? (
            <input
              autoFocus
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSaveName(); }
                if (e.key === 'Escape') { setEditingName(false); setPendingName(project.name); }
              }}
              disabled={savingField === 'name'}
              className="w-full rounded-lg border border-blue-400 bg-white px-2 py-0.5 text-base font-bold text-slate-900 outline-none ring-2 ring-blue-100 dark:border-blue-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-blue-900/40"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="group flex w-full items-center gap-1.5 text-left text-base font-bold text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
              title="Click to rename"
            >
              <span className="truncate">{project.name}</span>
              <Pencil size={11} className="flex-shrink-0 text-slate-400 opacity-0 group-hover:opacity-100" />
            </button>
          )}
          <p className="mt-0.5 text-xs text-slate-400">
            Created {formatRelativeDate(project.createdAt)}
            {' · '}Last updated {formatRelativeDate(project.updatedAt)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <X size={16} />
        </button>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-2.5 dark:border-slate-800">
        <button
          onClick={() => onNavigate(project.id)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          Open
        </button>
        <button
          onClick={() => setIsDiffMode((v) => !v)}
          disabled={isDiffMode}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-blue-700 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
        >
          <GitCompare size={12} />
          Compare
        </button>
      </div>

      {/* Save error */}
      {saveError && (
        <div className="flex items-center gap-1.5 border-b border-red-100 bg-red-50 px-5 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/10 dark:text-red-400">
          <AlertCircle size={12} />
          {saveError}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* About */}
        <section className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">About</h3>
          {editingDescription ? (
            <>
              <textarea
                autoFocus
                rows={4}
                value={pendingDescription}
                onChange={(e) => setPendingDescription(e.target.value)}
                disabled={savingField === 'description'}
                placeholder="Add a description…"
                className="w-full rounded-lg border border-blue-400 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none ring-2 ring-blue-100 dark:border-blue-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-blue-900/40"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={handleSaveDescription}
                  disabled={savingField === 'description'}
                  className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingField === 'description'
                    ? <Loader2 size={11} className="animate-spin" />
                    : 'Save'}
                </button>
                <button
                  onClick={() => { setEditingDescription(false); setPendingDescription(project.description ?? ''); }}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setEditingDescription(true)}
              className="block w-full rounded-lg border border-transparent px-2 py-1.5 text-left text-sm hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/50"
              title="Click to edit description"
            >
              {project.description
                ? <span className="text-slate-700 dark:text-slate-300">{project.description}</span>
                : <span className="italic text-slate-400 dark:text-slate-500">Add a description…</span>}
            </button>
          )}
        </section>

        {/* Versions */}
        <section>
          <h3 className="px-5 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Versions</h3>
          <VersionList
            projectId={project.id}
            hasDraft={project.hasDraft}
            onNavigate={onNavigate}
            onView={onView}
            onDiff={onDiff}
            isDiffMode={isDiffMode}
            onExitDiffMode={() => setIsDiffMode(false)}
          />
        </section>

        {/* Danger zone */}
        <section className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Danger zone</h3>
          <button
            onClick={() => onRequestDelete(project)}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400"
          >
            <Trash2 size={12} />
            Delete project
          </button>
        </section>
      </div>
    </div>
  );
}
