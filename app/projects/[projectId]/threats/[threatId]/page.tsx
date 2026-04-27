'use client';

import dynamic from 'next/dynamic';
import { use } from 'react';

const ThreatDetailPage = dynamic(() => import('@/components/ThreatDetailPage'), { ssr: false });

interface PageProps {
  params: Promise<{ projectId: string; threatId: string }>;
}

export default function Page(props: PageProps) {
  const params = use(props.params);
  return <ThreatDetailPage projectId={params.projectId} threatId={params.threatId} />;
}
