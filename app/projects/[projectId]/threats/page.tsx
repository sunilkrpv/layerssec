import dynamic from 'next/dynamic';

const ThreatsDashboardPage = dynamic(() => import('@/components/ThreatsDashboardPage'), { ssr: false });

interface PageProps {
  params: { projectId: string };
}

export default function Page({ params }: PageProps) {
  return <ThreatsDashboardPage projectId={params.projectId} />;
}
