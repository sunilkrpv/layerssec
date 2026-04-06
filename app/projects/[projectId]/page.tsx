'use client';

import dynamic from 'next/dynamic';
import { use } from 'react';

// DiagramPage depends heavily on localStorage and browser-only APIs (React Flow,
// File System Access API, window.history, etc.).  Disabling SSR prevents the
// hydration mismatch that occurs when useState initialisers read localStorage on
// the client but return different defaults during server pre-rendering.
const DiagramPage = dynamic(() => import('@/components/DiagramPage'), { ssr: false });

interface PageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default function ProjectPage(props: PageProps) {
  const searchParams = use(props.searchParams);
  const params = use(props.params);
  return <DiagramPage projectId={params.projectId} viewDiagramId={searchParams.view} />;
}
