'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, FolderOpen, Plus, Clock, ChevronRight } from 'lucide-react';
import { apiListProjects, apiGetProject, apiCreateProject, apiCreateDiagram, apiGetDiagram, type Project } from '@/lib/api';
import type { ProjectFile } from '@/lib/layerStore';

interface ProjectsModalProps {
  /** Called when user selects a project; includes the loaded canvasData and the backend diagramId */
  onOpen: (project: Project, canvasData: ProjectFile, diagramId: string) => void;
  onCreate: (project: Project) => void;
  onClose: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProjectsModal({ onOpen, onCreate, onClose }: ProjectsModalProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create new project state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    apiListProjects()
      .then(setProjects)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Failed to load projects'),
      )
      .finally(() => setIsLoading(false));
  }, []);

  const handleOpen = async (project: Project) => {
    setOpeningId(project.id);
    setError(null);
    try {
      const full = await apiGetProject(project.id);
      if (!full.diagrams.length) {
        // Project has no diagrams yet — create a blank one so we always have a valid diagramId
        const blank: ProjectFile = { layers: {}, navStack: [] };
        const created = await apiCreateDiagram(full.id, 'main', blank);
        onOpen(project, blank, created.id);
        return;
      }
      // Fetch the first diagram's full canvasData
      const diagram = await apiGetDiagram(full.diagrams[0].id);
      const canvasData = (diagram.canvasData ?? {}) as ProjectFile;
      onOpen(project, canvasData, diagram.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to open project');
    } finally {
      setOpeningId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setIsCreating(true);
    setError(null);
    try {
      const project = await apiCreateProject(trimmed);
      onCreate(project);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl" style={{ maxHeight: '70vh' }}>
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">My Projects</h2>
            <p className="text-xs text-slate-500">Your diagrams saved in the cloud</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex-shrink-0 border-b border-red-100 bg-red-50 px-6 py-2.5 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Project list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Loading projects…
            </div>
          ) : projects.length === 0 ? (
            <div className="py-16 text-center">
              <FolderOpen size={32} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm text-slate-500">No projects yet.</p>
              <p className="mt-1 text-xs text-slate-400">Create one to get started.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => handleOpen(p)}
                    disabled={!!openingId}
                    className="flex w-full items-center gap-3 px-6 py-3.5 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <FolderOpen size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-800">{p.name}</span>
                        {p._count?.diagrams !== undefined && (
                          <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                            {p._count.diagrams} diagram{p._count.diagrams !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {p.description && (
                        <p className="mt-0.5 truncate text-xs text-slate-500">{p.description}</p>
                      )}
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                        <Clock size={10} />
                        <span>Updated {formatDate(p.updatedAt)}</span>
                      </div>
                    </div>
                    {openingId === p.id ? (
                      <Loader2 size={14} className="flex-shrink-0 animate-spin text-blue-500" />
                    ) : (
                      <ChevronRight size={14} className="flex-shrink-0 text-slate-400" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer — create new project */}
        <div className="flex-shrink-0 border-t border-slate-100 p-4">
          {showCreate ? (
            <form onSubmit={handleCreate} className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Project name"
                autoFocus
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                className="rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              <Plus size={14} />
              New project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
