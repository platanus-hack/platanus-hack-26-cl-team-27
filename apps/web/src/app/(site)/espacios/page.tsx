import type { Metadata } from 'next';

import { SpaceExplorer } from '@/components/espacios/SpaceExplorer';

export const metadata: Metadata = { title: 'Espacios' };

export default function SpacesPage() {
  return <SpaceExplorer />;
}
