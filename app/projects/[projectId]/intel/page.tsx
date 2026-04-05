import { Suspense } from 'react';
import SecurityIntelPage from '@/components/SecurityIntelPage';

export default function IntelPage({ params }: { params: { projectId: string } }) {
  return (
    <Suspense>
      <SecurityIntelPage projectId={params.projectId} />
    </Suspense>
  );
}
