'use client';
import dynamic from 'next/dynamic';

const DiagramPage = dynamic(() => import('@/components/DiagramPage'), { ssr: false });

interface CanvasPaneProps {
  projectId: string;
  diagramId: string;
}

export function CanvasPane({ projectId, diagramId }: CanvasPaneProps) {
  return <DiagramPage key={diagramId} projectId={projectId} viewDiagramId={diagramId} />;
}
