'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity, AlertCircle, FolderOpen, LayoutDashboard, Loader2, LogOut, Monitor, Moon, Plus,
  Search, Sun, User,
} from 'lucide-react';
import LayersLogo from '@/components/LayersLogo';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import DeleteProjectModal from '@/components/projects/DeleteProjectModal';
import { NewProjectModal } from '@/components/projects/NewProjectModal';
import { ProjectsTable } from '@/components/projects/ProjectsTable';
import { ProjectSideSheet } from '@/components/projects/ProjectSideSheet';
import {
  apiCreateProject, apiListProjects,
  type ProjectWithVersioning, type DiagramVersion,
} from '@/lib/api';
import { isLoggedIn, getStoredUser, signOut } from '@/lib/authStore';
import { useTheme } from '@/lib/themeContext';

type StatusFilter = 'all' | 'draft' | 'published';

function ProjectsListInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();

  const [projects, setProjects] = useState<ProjectWithVersioning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectWithVersioning | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectWithVersioning | null>(null);
  const [user, setUser] = useState<{ name?: string | null; email: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get('status') as StatusFilter | null) ?? 'all',
  );

  // Initial auth + list load
  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return; }
    const stored = getStoredUser();
    if (stored) setUser({ name: stored.name, email: stored.email });
    apiListProjects()
      .then(setProjects)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load projects'))
      .finally(() => setLoading(false));
  }, [router]);

  // URL sync (immediate)
  useEffect(() => {
    const qs = new URLSearchParams();
    if (searchQuery) qs.set('q', searchQuery);
    if (statusFilter !== 'all') qs.set('status', statusFilter);
    const next = qs.toString();
    router.replace(`/projects${next ? `?${next}` : ''}`);
  }, [searchQuery, statusFilter, router]);

  // Resync selectedProject after every list change
  useEffect(() => {
    if (!selectedProject) return;
    const fresh = projects.find((p) => p.id === selectedProject.id);
    if (!fresh) {
      setSelectedProject(null);
    } else if (fresh !== selectedProject) {
      setSelectedProject(fresh);
    }
  }, [projects, selectedProject]);

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

  const handleProjectChanged = useCallback((next: ProjectWithVersioning) => {
    setProjects((prev) => prev.map((p) => p.id === next.id ? next : p));
  }, []);

  const handleDeleted = useCallback((projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setDeleteTarget(null);
  }, []);

  const cycleTheme = () => {
    const cycle = ['light', 'dark', 'system'] as const;
    setTheme(cycle[(cycle.indexOf(theme) + 1) % cycle.length]);
  };

  const filteredProjects = projects
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((p) => {
      if (statusFilter === 'draft') return p.hasDraft;
      if (statusFilter === 'published') return !p.hasDraft && p.publishedCount > 0;
      return true;
    });

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <header className="flex h-9 flex-shrink-0 items-center border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="mr-4 flex items-center gap-1.5 pl-1">
          <LayersLogo size={14} className="text-blue-600" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Layers</span>
        </div>
        <button
          onClick={() => router.push('/home')}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          <LayoutDashboard size={13} />
          <span className="hidden sm:inline">Home</span>
        </button>
        <button
          onClick={() => router.push('/activity')}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          <Activity size={13} />
          <span className="hidden sm:inline">AI Activity</span>
        </button>
        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={cycleTheme}
            title={`Theme: ${theme} — click to cycle`}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            {theme === 'light' ? <Sun size={14} /> : theme === 'dark' ? <Moon size={14} /> : <Monitor size={14} />}
            <span className="hidden sm:inline capitalize">{theme}</span>
          </button>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
          {user && (
            <button
              onClick={() => { signOut(); router.push('/login'); }}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              title="Sign out"
            >
              <User size={13} className="text-slate-500 dark:text-slate-400" />
              <span className="max-w-[140px] truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</span>
              <LogOut size={12} className="text-slate-400 dark:text-slate-500" />
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="flex-shrink-0 border-b border-red-100 bg-red-50 px-5 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/10 dark:text-red-400">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={14} />
            {error}
          </div>
        </div>
      )}

      <main className="flex flex-1 flex-col overflow-auto">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100">My Projects</h1>
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            className="h-8 px-3 py-0 text-xs"
          >
            <Plus size={13} />
            New Project
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            Loading…
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6 py-12">
            <EmptyState
              icon={<FolderOpen size={28} />}
              heading="No projects yet"
              subtext="Create your first project to start mapping threats."
              cta={
                <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                  <Plus size={13} />
                  Create your first project
                </Button>
              }
            />
          </div>
        ) : (
          <div className="px-5 py-5">
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
              <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
                {filteredProjects.length} of {projects.length}
              </span>
            </div>

            {filteredProjects.length === 0 ? (
              <div className="py-12">
                <EmptyState
                  icon={<Search size={24} />}
                  heading="No projects match your filters"
                  subtext="Try adjusting or clearing your filters."
                  cta={
                    <Button
                      variant="secondary"
                      onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              </div>
            ) : (
              <ProjectsTable
                projects={filteredProjects}
                selectedId={selectedProject?.id ?? null}
                onSelect={setSelectedProject}
                onRequestDelete={setDeleteTarget}
              />
            )}
          </div>
        )}
      </main>

      {showCreateModal && (
        <NewProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}

      {deleteTarget && (
        <DeleteProjectModal
          project={{ id: deleteTarget.id, name: deleteTarget.name }}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}

      {selectedProject && (
        <>
          <div
            className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-[1px]"
            onClick={() => setSelectedProject(null)}
          />
          <ProjectSideSheet
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
            onNavigate={handleNavigate}
            onView={handleView}
            onDiff={handleDiff}
            onProjectChanged={handleProjectChanged}
            onRequestDelete={setDeleteTarget}
          />
        </>
      )}
    </div>
  );
}

export default function ProjectsListPage() {
  return (
    <Suspense>
      <ProjectsListInner />
    </Suspense>
  );
}
