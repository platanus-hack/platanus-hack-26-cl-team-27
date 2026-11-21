import { PageHeader } from '@team27/ui';
import type { Metadata } from 'next';

import { buttonLink } from '@/components/common/link-styles';
import { AccountPanel } from '@/components/cuenta/AccountPanel';
import { SessionGate } from '@/components/cuenta/SessionGate';
import { LOGOUT_HREF } from '@/lib/account-routes';

export const metadata: Metadata = { title: 'Cuenta' };

export const dynamic = 'force-dynamic';

export default function AccountPage() {
  return (
    <SessionGate title="Tu cuenta" returnTo="/cuenta">
      {(email) => (
        <>
          <PageHeader
            title="Tu cuenta"
            description={email}
            actions={
              <a href={LOGOUT_HREF} className={buttonLink('secondary', 'sm')}>
                Salir
              </a>
            }
          />
          <AccountPanel />
        </>
      )}
    </SessionGate>
  );
}
