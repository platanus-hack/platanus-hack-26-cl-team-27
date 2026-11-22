import { Notice, PageHeader } from '@team27/ui';
import type { ReactNode } from 'react';

import { buttonLink } from '@/components/common/link-styles';
import { loginHref } from '@/lib/account-routes';
import { auth0 } from '@/lib/auth0';

export async function SessionGate({
  title,
  returnTo,
  children,
}: {
  readonly title: string;
  readonly returnTo: string;
  readonly children: (email: string) => ReactNode;
}) {
  if (!auth0) {
    return (
      <>
        <PageHeader title={title} />
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
          title={title}
          description="Entra con tu correo para trabajar en los proyectos de tu organización. No necesitas contraseña."
        />
        <a href={loginHref(returnTo)} className={buttonLink('primary')}>
          Entrar con tu correo
        </a>
      </>
    );
  }
  return children(session.user.email ?? '');
}
