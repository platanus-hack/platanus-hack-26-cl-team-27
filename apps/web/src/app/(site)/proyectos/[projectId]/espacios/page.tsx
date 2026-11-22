import type { Metadata } from 'next';

import { SessionGate } from '@/components/cuenta/SessionGate';
import { SpaceExplorer } from '@/components/espacios/SpaceExplorer';
import { ProjectProvider } from '@/components/proyectos/ProjectContext';
import { projectPage } from '@/lib/project-paths';

export const metadata: Metadata = { title: 'Espacios' };

export const dynamic = 'force-dynamic';

const first = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

export default async function SpacesPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ projectId: string }>;
  readonly searchParams: Promise<{
    espacio?: string | string[];
    documento?: string | string[];
    revision?: string | string[];
  }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  return (
    <SessionGate
      title="Espacios"
      returnTo={projectPage(projectId, '/espacios')}
    >
      {() => (
        <ProjectProvider projectId={projectId}>
          <SpaceExplorer
            initialSpace={first(query.espacio)}
            initialDocument={first(query.documento)}
            initialRevision={first(query.revision)}
          />
        </ProjectProvider>
      )}
    </SessionGate>
  );
}
