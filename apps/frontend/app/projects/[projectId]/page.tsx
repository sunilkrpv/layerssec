'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { apiGetProject, ProjectWithDiagrams } from '@/lib/api';
import { FEATURES } from '@/lib/features';
import { ProjectShell } from '@/components/projects/ProjectShell';
import type { RailSelection, LeftRailDiagram } from '@/components/projects/LeftRailDiagramList';

// Legacy single-canvas page (used when MULTI_FLOW_UI is off)
const DiagramPage = dynamic(() => import('@/components/DiagramPage'), { ssr: false });

interface PageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string; diagram?: string }>;
}

export default function ProjectPage(props: PageProps) {
  const searchParams = use(props.searchParams);
  const params = use(props.params);
  const router = useRouter();

  useEffect(() => {
    if (params.projectId === 'local') {
      router.replace('/login');
    }
  }, [params.projectId, router]);

  if (params.projectId === 'local') return null;

  if (!FEATURES.MULTI_FLOW_UI) {
    return <DiagramPage projectId={params.projectId} viewDiagramId={searchParams.view} />;
  }

  return <SplitViewProjectPage projectId={params.projectId} viewParam={searchParams.view} diagramParam={searchParams.diagram} />;
}

function SplitViewProjectPage({ projectId, viewParam, diagramParam }: { projectId: string; viewParam?: string; diagramParam?: string }) {
  const [project, setProject] = useState<ProjectWithDiagrams | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGetProject(projectId)
      .then(setProject)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load project'));
  }, [projectId]);

  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;
  if (!project) return <div className="p-6 text-sm text-slate-500">Loading project…</div>;

  const diagrams: LeftRailDiagram[] = project.diagrams.map((d) => ({
    id: d.id,
    name: d.name,
    threatCount: 0, // backfilled by the rail in a future iteration
  }));

  // Backwards compatibility: ?view=<uuid> previously selected that diagram.
  const initialDiagramId = diagramParam || (viewParam && viewParam !== 'project' ? viewParam : undefined);
  const initialSelection: RailSelection = initialDiagramId
    ? { kind: 'diagram', id: initialDiagramId }
    : { kind: 'project' };

  return <ProjectShell projectId={projectId} diagrams={diagrams} initialSelection={initialSelection} />;
}
