'use client';

import dynamic from 'next/dynamic';
import { use } from 'react';

const AIHistoryPage = dynamic(() => import('@/components/AIHistoryPage'), { ssr: false });

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default function Page(props: PageProps) {
  const params = use(props.params);
  return <AIHistoryPage projectId={params.projectId} />;
}
