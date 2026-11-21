import type { Metadata } from 'next';

import { CaseScreen } from '@/components/caso/CaseScreen';

export const metadata: Metadata = { title: 'Caso P-12' };

export default async function CasePage({
  params,
}: {
  readonly params: Promise<{ castId: string }>;
}) {
  const { castId } = await params;
  return <CaseScreen castId={castId} />;
}
