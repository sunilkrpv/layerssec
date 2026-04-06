import dynamic from 'next/dynamic';

const AIHistoryPage = dynamic(() => import('@/components/AIHistoryPage'), { ssr: false });

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function Page(props: PageProps) {
  const params = await props.params;
  return <AIHistoryPage projectId={params.projectId} />;
}
