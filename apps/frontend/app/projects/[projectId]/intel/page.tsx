import { Suspense } from 'react';
import SecurityIntelPage from '@/components/SecurityIntelPage';

export default async function IntelPage(props: { params: Promise<{ projectId: string }> }) {
  const params = await props.params;
  return (
    <Suspense>
      <SecurityIntelPage projectId={params.projectId} />
    </Suspense>
  );
}
