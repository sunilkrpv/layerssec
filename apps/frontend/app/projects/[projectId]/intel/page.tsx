import { redirect } from 'next/navigation';

export default async function IntelPage(props: { params: Promise<{ projectId: string }> }) {
  const params = await props.params;
  redirect(`/projects/${params.projectId}?view=project`);
}
