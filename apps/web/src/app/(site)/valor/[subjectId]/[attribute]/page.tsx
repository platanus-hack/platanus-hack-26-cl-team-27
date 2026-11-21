import type { Metadata } from 'next';

import { ValuePage } from '@/components/valor/ValuePage';

export const metadata: Metadata = { title: 'Procedencia' };

export default async function ValueRoute({
  params,
}: {
  readonly params: Promise<{ subjectId: string; attribute: string }>;
}) {
  const { subjectId, attribute } = await params;
  return (
    <ValuePage
      subjectId={decodeURIComponent(subjectId)}
      attribute={decodeURIComponent(attribute)}
    />
  );
}
