'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// DiffPage uses useSearchParams() which requires a Suspense boundary during SSR.
// Disabling SSR avoids the mismatch and the explicit Suspense wrapper requirement.
const DiffPage = dynamic(() => import('@/components/DiffPage'), { ssr: false });

export default function DiffRoute() {
  return (
    <Suspense>
      <DiffPage />
    </Suspense>
  );
}
