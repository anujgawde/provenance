import { CanvasShell } from '@/components/CanvasShell';

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CanvasShell projectId={id} />;
}
