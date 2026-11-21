import type { Metadata } from 'next';

import { ChangeDetailView } from '@/components/cambios/ChangeDetailView';

export const metadata: Metadata = { title: 'Propuesta de cambio' };

export default async function ChangePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ para?: string | string[] }>;
}) {
  const { id } = await params;
  const { para } = await searchParams;
  return (
    <ChangeDetailView
      changeId={id}
      forStakeholder={typeof para === 'string' ? para : null}
    />
  );
}
