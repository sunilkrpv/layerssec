import { Suspense } from 'react';
import AIActivityPage from '@/components/AIActivityPage';

export const metadata = { title: 'AI Activity — Layers' };

export default function Page() {
  return (
    <Suspense>
      <AIActivityPage />
    </Suspense>
  );
}
