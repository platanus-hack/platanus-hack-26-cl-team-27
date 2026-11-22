import type { Metadata } from 'next';

import { ConnectorsConsole } from '@/components/conectores/ConnectorsConsole';
import { SessionGate } from '@/components/cuenta/SessionGate';
import {
  CONNECTORS_PATH,
  connectionFeedback,
  connectorsHref,
} from '@/lib/integrations-api';

export const metadata: Metadata = { title: 'Conectores' };

export const dynamic = 'force-dynamic';

const first = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

export default async function ConnectorsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    proyecto?: string | string[];
    google?: string | string[];
    motivo?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const project = first(params.proyecto);
  return (
    <SessionGate
      title="Conectores"
      returnTo={project ? connectorsHref(project) : CONNECTORS_PATH}
    >
      {() => (
        <ConnectorsConsole
          initialProject={project}
          initialFeedback={connectionFeedback(
            first(params.google),
            first(params.motivo),
          )}
        />
      )}
    </SessionGate>
  );
}
