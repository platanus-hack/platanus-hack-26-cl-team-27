import type { Metadata } from 'next';

import { ModelExplorer } from '@/components/modelos/ModelExplorer';

export const metadata: Metadata = { title: 'Modelos' };

export default function ModelsPage() {
  return <ModelExplorer />;
}
