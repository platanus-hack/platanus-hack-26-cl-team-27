import { PageHeader } from '@team27/ui';
import type { Metadata } from 'next';

import { AdminPanel } from '@/components/admin/AdminPanel';
import { SessionGate } from '@/components/cuenta/SessionGate';

export const metadata: Metadata = { title: 'Administración' };

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return (
    <SessionGate title="Administración" returnTo="/admin">
      {() => (
        <>
          <PageHeader
            title="Administración"
            description="Todos los usuarios, organizaciones e invitaciones de Vigente."
          />
          <AdminPanel />
        </>
      )}
    </SessionGate>
  );
}
