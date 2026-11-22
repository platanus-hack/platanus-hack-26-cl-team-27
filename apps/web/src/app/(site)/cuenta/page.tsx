import { Notice, PageHeader } from '@team27/ui';
import type { Metadata } from 'next';

import { buttonLink } from '@/components/common/link-styles';
import { AccountPanel } from '@/components/cuenta/AccountPanel';
import { SessionGate } from '@/components/cuenta/SessionGate';
import { LOGOUT_HREF } from '@/lib/account-routes';
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
          {notice && (
            <Notice tone={notice.tone} className="mb-6">
              {notice.text}
            </Notice>
          )}
          <AccountPanel />
        </>
      )}
    </SessionGate>
  );
}
