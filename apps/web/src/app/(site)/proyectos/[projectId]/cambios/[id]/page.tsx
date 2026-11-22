import type { Metadata } from 'next';

import { ChangeDetailView } from '@/components/cambios/ChangeDetailView';
import { SessionGate } from '@/components/cuenta/SessionGate';
import { ProjectProvider } from '@/components/proyectos/ProjectContext';
import { projectPage } from '@/lib/project-paths';

export const metadata: Metadata = { title: 'Propuesta de cambio' };

export const dynamic = 'force-dynamic';

export default async function ChangePage({
  params,
}: {
  readonly params: Promise<{ projectId: string; id: string }>;
}) {
  const { projectId, id } = await params;
  return (
    <SessionGate
      title="Propuesta de cambio"
      returnTo={projectPage(projectId, `/cambios/${id}`)}
    >
      {() => (
        <ProjectProvider projectId={projectId}>
          <ChangeDetailView changeId={id} />
        </ProjectProvider>
      )}
    </SessionGate>
  );
}
