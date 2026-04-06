'use client';

import dynamic from 'next/dynamic';
import { use } from 'react';

const ThreatsDashboardPage = dynamic(() => import('@/components/ThreatsDashboardPage'), { ssr: false });

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default function Page(props: PageProps) {
  const params = use(props.params);
  return <ThreatsDashboardPage projectId={params.projectId} />;
}
