'use client';

import { Card, Field, Input } from '@team27/ui';
import { useState } from 'react';

import { Empty, LoadError, Loading } from '@/components/common/LoadState';
import { useResource } from '@/hooks/use-resource';
import { ROLE_LABELS } from '@/lib/accounts-api';
import { filterAdminUsers, getAdminUsers } from '@/lib/admin-api';

export function UsersCard({ version }: { readonly version: number }) {
  const [query, setQuery] = useState('');
  const resource = useResource(
    (signal) => getAdminUsers(signal),
    `users:${version}`,
  );
  const shown = resource.data ? filterAdminUsers(resource.data, query) : null;
  return (
    <Card
      title="Usuarios"
      description={
        resource.data
          ? `${resource.data.users.length} con cuenta y ${resource.data.invitations.length} invitaciones pendientes`
          : undefined
      }
    >
      <Field label="Buscar por nombre o correo" className="mb-4">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="paula@…"
        />
      </Field>
      {resource.error && <LoadError message={resource.error} />}
      {!resource.data && !resource.error && <Loading />}
      {shown && shown.users.length === 0 && shown.invitations.length === 0 && (
        <Empty>Nadie calza con esa búsqueda.</Empty>
      )}
      {shown && (
        <ul className="flex flex-col divide-y divide-hairline">
          {shown.users.map((user) => (
            <li key={user.id} className="flex flex-col gap-1 py-2">
              <span className="text-ink">
                {user.name ?? user.email}
                {user.name && (
                  <span className="ml-2 text-sm text-ink-2">{user.email}</span>
                )}
              </span>
              <span className="text-sm text-ink-2">
                {user.organizations.length === 0
                  ? 'Sin organización'
                  : user.organizations
                      .map(
                        (organization) =>
                          `${organization.name} (${ROLE_LABELS[organization.role].toLowerCase()})`,
                      )
                      .join(' · ')}
              </span>
            </li>
          ))}
          {shown.invitations.map((invitation) => (
            <li key={invitation.id} className="flex flex-col gap-1 py-2">
              <span className="text-ink-2">
                {invitation.email}
                <span className="ml-2 text-sm">Pendiente</span>
              </span>
              <span className="text-sm text-ink-2">
                Invitado a {invitation.organizationName} como{' '}
                {ROLE_LABELS[invitation.role].toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
