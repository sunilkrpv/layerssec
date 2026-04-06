import dynamic from 'next/dynamic';

// DiagramPage depends heavily on localStorage and browser-only APIs (React Flow,
// File System Access API, window.history, etc.).  Disabling SSR prevents the
// hydration mismatch that occurs when useState initialisers read localStorage on
// the client but return different defaults during server pre-rendering.
const DiagramPage = dynamic(() => import('@/components/DiagramPage'), { ssr: false });

interface PageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function ProjectPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  return <DiagramPage projectId={params.projectId} viewDiagramId={searchParams.view} />;
}
