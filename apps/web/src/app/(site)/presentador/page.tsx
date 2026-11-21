import type { Metadata } from 'next';

import { PresenterConsole } from '@/components/presentador/PresenterConsole';

export const metadata: Metadata = { title: 'Presentador' };

export default function PresenterPage() {
  return <PresenterConsole />;
}
