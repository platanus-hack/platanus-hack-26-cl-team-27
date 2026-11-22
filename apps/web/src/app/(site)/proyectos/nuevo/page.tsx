import { PageHeader } from '@team27/ui';
import type { Metadata } from 'next';

import { SessionGate } from '@/components/cuenta/SessionGate';
import { NewProjectForm } from '@/components/proyectos/NewProjectForm';

export const metadata: Metadata = { title: 'Nuevo proyecto' };

export const dynamic = 'force-dynamic';

export default async function NewProjectPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ organizacion?: string | string[] }>;
}) {
  const { organizacion } = await searchParams;
  return (
    <SessionGate title="Nuevo proyecto" returnTo="/proyectos/nuevo">
      {() => (
        <>
          <PageHeader
            title="Nuevo proyecto"
            description="Dale un nombre y queda en tu organización. El equipo, los documentos y el mapa de dependencias se suman después."
          />
          <NewProjectForm
            requestedOrganization={
              typeof organizacion === 'string' ? organizacion : null
            }
          />
        </>
      )}
    </SessionGate>
  );
}
