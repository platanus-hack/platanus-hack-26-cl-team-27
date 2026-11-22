import type { Metadata } from 'next';

import { SessionGate } from '@/components/cuenta/SessionGate';
import { ModelStudio } from '@/components/modelo/ModelStudio';
import { projectPage } from '@/lib/project-paths';

export const metadata: Metadata = { title: 'Modelo 3D' };

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  readonly params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <SessionGate title="Modelo 3D" returnTo={projectPage(projectId, '/modelo')}>
      {() => <ModelStudio projectId={projectId} />}
    </SessionGate>
  );
}
