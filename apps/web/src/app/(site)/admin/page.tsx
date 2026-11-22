import { PageHeader } from '@team27/ui';
import type { Metadata } from 'next';

import { AdminPanel } from '@/components/admin/AdminPanel';
import { buttonLink } from '@/components/common/link-styles';
import { SessionGate } from '@/components/cuenta/SessionGate';
import { LOGOUT_HREF } from '@/lib/account-routes';
import { ADMIN_HREF } from '@/lib/admin-api';

export const metadata: Metadata = { title: 'Administración' };

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return (
    <SessionGate title="Administración" returnTo={ADMIN_HREF}>
      {(email) => (
        <>
          <PageHeader
            title="Administración"
            description={`Todos los usuarios, organizaciones e invitaciones de Vigente. Entraste como ${email}.`}
            actions={
              <a href={LOGOUT_HREF} className={buttonLink('secondary', 'sm')}>
                Salir
              </a>
            }
          />
          <AdminPanel />
        </>
      )}
    </SessionGate>
  );
}
