import { PageHeader } from '@team27/ui';
import type { Metadata } from 'next';

import { NewOrganizationForm } from '@/components/cuenta/NewOrganizationForm';
import { SessionGate } from '@/components/cuenta/SessionGate';
import { NEW_ORGANIZATION_HREF } from '@/lib/accounts-api';

export const metadata: Metadata = { title: 'Nueva organización' };

export const dynamic = 'force-dynamic';

export default function NewOrganizationPage() {
  return (
    <SessionGate title="Nueva organización" returnTo={NEW_ORGANIZATION_HREF}>
      {() => (
        <>
          <PageHeader
            title="Nueva organización"
            description="Quedas como su administrador. Después invitas a tu equipo y creas sus proyectos desde tu cuenta."
          />
          <NewOrganizationForm />
        </>
      )}
    </SessionGate>
  );
}
