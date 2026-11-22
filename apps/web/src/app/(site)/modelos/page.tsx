import type { Metadata } from 'next';

import { SessionGate } from '@/components/cuenta/SessionGate';
import { ModelExplorer } from '@/components/modelos/ModelExplorer';

export const metadata: Metadata = { title: 'Modelos' };

export const dynamic = 'force-dynamic';

export default function ModelsPage() {
  return (
    <SessionGate title="Modelos" returnTo="/modelos">
      {() => <ModelExplorer />}
    </SessionGate>
  );
}
