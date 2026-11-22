import { Notice, PageHeader } from '@team27/ui';
import type { Metadata } from 'next';

import { AccountPanel } from '@/components/cuenta/AccountPanel';
import { buttonLink } from '@/components/common/link-styles';
import { LOGOUT_HREF, loginHref } from '@/lib/account-routes';
import { auth0 } from '@/lib/auth0';
import { callbackNotice } from '@/lib/autodesk-api';

export const metadata: Metadata = { title: 'Cuenta' };

export const dynamic = 'force-dynamic';

const single = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? '';

export default async function AccountPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    autodesk?: string | string[];
    motivo?: string | string[];
  }>;
}) {
  const { autodesk, motivo } = await searchParams;
  const notice = callbackNotice(
    new URLSearchParams({ autodesk: single(autodesk), motivo: single(motivo) }),
  );
  if (!auth0) {
    return (
      <>
        <PageHeader title="Tu cuenta" />
        <Notice>
          Las cuentas no están configuradas en este ambiente. La sala y el caso
          funcionan igual, sin cuenta.
        </Notice>
      </>
    );
  }
  const session = await auth0.getSession();
  if (!session) {
    return (
      <>
        <PageHeader
          title="Tu cuenta"
          description="Entra con tu correo para ver los proyectos de tu organización. No necesitas contraseña."
        />
        <a href={loginHref('/cuenta')} className={buttonLink('primary')}>
          Entrar con tu correo
        </a>
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Tu cuenta"
        description={session.user.email}
        actions={
          <a href={LOGOUT_HREF} className={buttonLink('secondary', 'sm')}>
            Salir
          </a>
        }
      />
      {notice && (
        <Notice tone={notice.tone} className="mb-6">
          {notice.text}
        </Notice>
      )}
      <AccountPanel />
    </>
  );
}
