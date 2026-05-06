'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';

// DiagramPage depends on browser-only APIs (React Flow, window, etc.). SSR is
// disabled to avoid hydration mismatch.
const DiagramPage = dynamic(() => import('@/components/DiagramPage'), { ssr: false });

interface PageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string }>;
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
  return <DiagramPage projectId={params.projectId} viewDiagramId={searchParams.view} />;
}
