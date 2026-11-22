'use client';

import { Notice } from '@team27/ui';
import { useState } from 'react';

import { LoadError, Loading } from '@/components/common/LoadState';
import { useResource } from '@/hooks/use-resource';
import { getMe } from '@/lib/accounts-api';
import { getAdminOrganizations } from '@/lib/admin-api';

import { InviteCard } from './InviteCard';
import { OrganizationsCard } from './OrganizationsCard';
import { UsersCard } from './UsersCard';

export function AdminPanel() {
  const me = useResource((signal) => getMe(signal), 'me');
  if (me.error) return <LoadError message={me.error} />;
  if (!me.data) return <Loading />;
  if (!me.data.superadmin) {
    return (
      <Notice tone="error">
        Esta sección es solo para los superadmins de Vigente.
      </Notice>
    );
  }
  return <Sections />;
}

function Sections() {
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((value) => value + 1);
  const organizations = useResource(
    (signal) => getAdminOrganizations(signal),
    `organizations:${version}`,
  );
  return (
    <div className="flex flex-col gap-6">
      <OrganizationsCard
        organizations={organizations.data?.organizations ?? null}
        error={organizations.error}
        onCreated={refresh}
      />
      <InviteCard
        organizations={organizations.data?.organizations ?? []}
        onInvited={refresh}
      />
      <UsersCard version={version} />
    </div>
  );
}
