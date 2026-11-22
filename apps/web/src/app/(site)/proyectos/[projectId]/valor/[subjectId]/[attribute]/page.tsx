import type { Metadata } from 'next';

import { SessionGate } from '@/components/cuenta/SessionGate';
import { ProjectProvider } from '@/components/proyectos/ProjectContext';
import { ValuePage } from '@/components/valor/ValuePage';
import { valuePath } from '@/lib/provenance-api';

export const metadata: Metadata = { title: 'Procedencia' };

export const dynamic = 'force-dynamic';

export default async function ValueRoute({
  params,
}: {
  readonly params: Promise<{
    projectId: string;
    subjectId: string;
    attribute: string;
  }>;
}) {
  const { projectId, subjectId, attribute } = await params;
  const subject = decodeURIComponent(subjectId);
  const key = decodeURIComponent(attribute);
  return (
    <SessionGate
      title="Procedencia"
      returnTo={valuePath(projectId, subject, key)}
    >
      {() => (
        <ProjectProvider projectId={projectId}>
          <ValuePage subjectId={subject} attribute={key} />
        </ProjectProvider>
      )}
    </SessionGate>
  );
}
