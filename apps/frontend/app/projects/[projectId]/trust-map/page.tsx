'use client';

import dynamic from 'next/dynamic';
import { use } from 'react';

const TrustMapPage = dynamic(() => import('@/components/TrustMapPage'), { ssr: false });

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default function Page(props: PageProps) {
  const params = use(props.params);
  return <TrustMapPage projectId={params.projectId} />;
}
