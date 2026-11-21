import type { Metadata } from 'next';

import { ConnectorsConsole } from '@/components/conectores/ConnectorsConsole';
import { connectionFeedback } from '@/lib/integrations-api';

export const metadata: Metadata = { title: 'Conectores' };

const first = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

export default async function ConnectorsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    google?: string | string[];
    motivo?: string | string[];
  }>;
}) {
  const params = await searchParams;
  return (
    <ConnectorsConsole
      initialFeedback={connectionFeedback(
        first(params.google),
        first(params.motivo),
      )}
    />
  );
}
