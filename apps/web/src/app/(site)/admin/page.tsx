import { Notice, PageHeader } from '@team27/ui';
import type { Metadata } from 'next';

import { AdminPanel } from '@/components/admin/AdminPanel';
import { buttonLink } from '@/components/common/link-styles';
import { loginHref } from '@/lib/account-routes';
import { auth0 } from '@/lib/auth0';

export const metadata: Metadata = { title: 'Administración' };

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!auth0) {
    return (
      <>
        <PageHeader title="Administración" />
        <Notice>Las cuentas no están configuradas en este ambiente.</Notice>
      </>
    );
  }
  const session = await auth0.getSession();
  if (!session) {
    return (
      <>
        <PageHeader
          title="Administración"
          description="Entra con tu correo de superadmin de Vigente."
        />
        <a href={loginHref('/admin')} className={buttonLink('primary')}>
          Entrar con tu correo
        </a>
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Administración"
        description="Todos los usuarios, organizaciones e invitaciones de Vigente."
      />
      <AdminPanel />
    </>
  );
}
