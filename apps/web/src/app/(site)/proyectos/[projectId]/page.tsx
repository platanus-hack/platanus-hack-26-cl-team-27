import type { Metadata } from 'next';

import { SessionGate } from '@/components/cuenta/SessionGate';
import { ProjectView } from '@/components/proyectos/ProjectView';
import { projectHref } from '@/lib/accounts-api';

export const metadata: Metadata = { title: 'Proyecto' };

export const dynamic = 'force-dynamic';

export default async function ProjectPage({
  params,
}: {
  readonly params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <SessionGate title="Proyecto" returnTo={projectHref(projectId)}>
      {() => <ProjectView projectId={projectId} />}
    </SessionGate>
  );
}
