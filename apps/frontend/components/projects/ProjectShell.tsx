'use client';
import { useState } from 'react';
import { LeftRailDiagramList, RailSelection, LeftRailDiagram } from './LeftRailDiagramList';
import { ProjectOverviewPane } from './ProjectOverviewPane';
import { CanvasPane } from './CanvasPane';
import { NewFlowDialog } from './NewFlowDialog';

export interface ProjectShellProps {
  projectId: string;
  diagrams: LeftRailDiagram[];
  initialSelection?: RailSelection;
}

export function ProjectShell({ projectId, diagrams: diagramsProp, initialSelection }: ProjectShellProps) {
  const [sel, setSel] = useState<RailSelection>(initialSelection ?? { kind: 'project' });
  const [newFlowOpen, setNewFlowOpen] = useState(false);
  const [diagrams, setDiagrams] = useState<LeftRailDiagram[]>(diagramsProp);

  return (
    <div className="flex h-full w-full">
      <LeftRailDiagramList
        diagrams={diagrams}
        selectedId={sel.kind === 'diagram' ? sel.id : undefined}
        onSelect={setSel}
      />
      <main className="flex-1 overflow-auto">
        {sel.kind === 'project'
          ? (
              <ProjectOverviewPane
                projectId={projectId}
                onOpenDiagram={(id) => setSel({ kind: 'diagram', id })}
                onNewFlow={() => setNewFlowOpen(true)}
              />
            )
          : <CanvasPane projectId={projectId} diagramId={sel.id} />}
      </main>
      <NewFlowDialog
        projectId={projectId}
        open={newFlowOpen}
        onOpenChange={setNewFlowOpen}
        onCreated={(d) => {
          setDiagrams((prev) => [...prev, { id: d.id, name: d.name, threatCount: 0 }]);
          setSel({ kind: 'diagram', id: d.id });
        }}
      />
    </div>
  );
}
