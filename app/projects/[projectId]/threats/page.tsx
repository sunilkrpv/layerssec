import dynamic from 'next/dynamic';

const ThreatsDashboardPage = dynamic(() => import('@/components/ThreatsDashboardPage'), { ssr: false });

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function Page(props: PageProps) {
  const params = await props.params;
  return <ThreatsDashboardPage projectId={params.projectId} />;
}
