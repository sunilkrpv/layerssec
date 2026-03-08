import dynamic from 'next/dynamic';

// DiagramPage depends heavily on localStorage and browser-only APIs (React Flow,
// File System Access API, window.history, etc.).  Disabling SSR prevents the
// hydration mismatch that occurs when useState initialisers read localStorage on
// the client but return different defaults during server pre-rendering.
const DiagramPage = dynamic(() => import('@/components/DiagramPage'), { ssr: false });

interface PageProps {
  params: { projectId: string };
  searchParams: { view?: string };
}

export default function ProjectPage({ params, searchParams }: PageProps) {
  return <DiagramPage projectId={params.projectId} viewDiagramId={searchParams.view} />;
}
