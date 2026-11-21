import type { Metadata } from 'next';

import { SalaBoard } from '@/components/sala/SalaBoard';

export const metadata: Metadata = { title: 'La sala' };

export default function SalaPage() {
  return <SalaBoard />;
}
