'use client';

interface Props {
  projectId: string;
}

export default function TrustMapPage({ projectId }: Props) {
  return (
    <div className="flex h-screen items-center justify-center bg-white text-slate-600 dark:bg-gray-950 dark:text-slate-300">
      Trust Map for project {projectId} — coming soon
    </div>
  );
}
