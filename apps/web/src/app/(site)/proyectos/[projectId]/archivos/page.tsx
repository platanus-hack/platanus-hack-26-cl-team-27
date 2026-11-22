import type { Metadata } from 'next';

import { ProjectFiles } from '@/components/archivos/ProjectFiles';
import { SessionGate } from '@/components/cuenta/SessionGate';
import { connectionFeedback } from '@/lib/integrations-api';
import { projectPage } from '@/lib/project-paths';

export const metadata: Metadata = { title: 'Archivos' };

export const dynamic = 'force-dynamic';

const first = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

export default async function ProjectFilesPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ projectId: string }>;
  readonly searchParams: Promise<{
    google?: string | string[];
    motivo?: string | string[];
  }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  return (
    <SessionGate
      title="Archivos"
      returnTo={projectPage(projectId, '/archivos')}
    >
      {() => (
        <ProjectFiles
          projectId={projectId}
          initialFeedback={connectionFeedback(
            first(query.google),
            first(query.motivo),
          )}
        />
      )}
    </SessionGate>
  );
}
