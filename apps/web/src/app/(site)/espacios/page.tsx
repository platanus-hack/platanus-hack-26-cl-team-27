import type { Metadata } from 'next';

import { SpaceExplorer } from '@/components/espacios/SpaceExplorer';

export const metadata: Metadata = { title: 'Espacios' };

const first = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

export default async function SpacesPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    espacio?: string | string[];
    documento?: string | string[];
    revision?: string | string[];
  }>;
}) {
  const params = await searchParams;
  return (
    <SpaceExplorer
      initialSpace={first(params.espacio)}
      initialDocument={first(params.documento)}
      initialRevision={first(params.revision)}
    />
  );
}
