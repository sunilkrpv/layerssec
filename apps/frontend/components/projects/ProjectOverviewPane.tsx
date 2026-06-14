'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { apiGetProject, apiUpdateProject, type ProjectWithDiagrams } from '@/lib/api';
import { ProjectMetadataForm } from './ProjectMetadataForm';
import { ThreatsRollupCard } from './widgets/ThreatsRollupCard';
import { PostureRollupCard } from './widgets/PostureRollupCard';
import { IntelReportCard } from './widgets/IntelReportCard';

interface Props {
  projectId: string;
  onOpenDiagram?: (id: string) => void;
  onNewFlow?: () => void;
}

export function ProjectOverviewPane({ projectId, onOpenDiagram, onNewFlow }: Props) {
  const [project, setProject] = useState<ProjectWithDiagrams | null>(null);

  useEffect(() => {
    apiGetProject(projectId).then(setProject).catch(console.error);
  }, [projectId]);

  if (!project) {
    return <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{project.description}</p>
          )}
        </div>
        {onNewFlow && (
          <button
            type="button"
            onClick={onNewFlow}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-blue-700"
          >
            <Plus size={14} />
            New Flow
          </button>
        )}
      </header>

      <section>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">Metadata</h2>
        <ProjectMetadataForm
          initial={{
            techStack: project.techStack ?? [],
            environment: project.environment ?? null,
            compliance: project.compliance ?? [],
            notes: project.notes ?? '',
            repoUrl: project.repoUrl ?? '',
          }}
          onSave={async (patch) => {
            await apiUpdateProject(projectId, patch);
            // Re-fetch to keep state fully hydrated
            const fresh = await apiGetProject(projectId);
            setProject(fresh);
          }}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ThreatsRollupCard projectId={projectId} />
        <PostureRollupCard projectId={projectId} onOpenDiagram={onOpenDiagram} />
        <IntelReportCard projectId={projectId} />
      </div>
    </div>
  );
}
