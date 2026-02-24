import DiagramPage from '@/components/DiagramPage';

interface PageProps {
  params: { projectId: string };
}

export default function ProjectPage({ params }: PageProps) {
  return <DiagramPage projectId={params.projectId} />;
}
