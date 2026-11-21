import type { Metadata } from 'next';

import { CasePresenter } from '@/components/caso/CasePresenter';

export const metadata: Metadata = { title: 'Caso P-12 · presentador' };

export default function CasePresenterPage() {
  return <CasePresenter />;
}
