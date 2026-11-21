import type { Metadata } from 'next';

import { SeatScreen } from '@/components/asiento/SeatScreen';

export const metadata: Metadata = { title: 'Tu asiento' };

export default async function SeatPage({
  params,
}: {
  readonly params: Promise<{ castId: string }>;
}) {
  const { castId } = await params;
  return <SeatScreen castId={castId} />;
}
