'use client';

import { Button, Card, Field, Input, Notice, Select } from '@team27/ui';
import { type FormEvent, useState } from 'react';

import { Empty } from '@/components/common/LoadState';
import { ROLE_LABELS, type Role } from '@/lib/accounts-api';
import { type AdminOrganization, inviteToOrganization } from '@/lib/admin-api';
import { describeError } from '@/lib/http';

export function InviteCard({
  organizations,
  onInvited,
}: {
  readonly organizations: readonly AdminOrganization[];
  readonly onInvited: () => void;
}) {
  const [email, setEmail] = useState('');
  const [chosen, setChosen] = useState('');
  const [role, setRole] = useState<Role>('admin');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const organizationId = chosen || organizations[0]?.id || '';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const invitation = await inviteToOrganization(
        organizationId,
        email,
        role,
      );
      setMessage({
        tone: 'success',
        text: `Invitamos a ${invitation.email} a ${invitation.organizationName} como ${ROLE_LABELS[invitation.role].toLowerCase()}. Su cuenta queda lista cuando entre con ese correo.`,
      });
      setEmail('');
      onInvited();
    } catch (error) {
      setMessage({ tone: 'error', text: describeError(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Crear un usuario"
      description="Invita un correo a una organización con su rol. Entra sin contraseña y queda en el equipo."
    >
      {organizations.length === 0 ? (
        <Empty>Crea una organización antes de invitar a alguien.</Empty>
      ) : (
        <form
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <Field label="Correo" className="flex-1">
            <Input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nombre@empresa.cl"
            />
          </Field>
          <Field label="Organización">
            <Select
              value={organizationId}
              onChange={(event) => setChosen(event.target.value)}
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Rol">
            <Select
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              <option value="admin">{ROLE_LABELS.admin}</option>
              <option value="member">{ROLE_LABELS.member}</option>
            </Select>
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? 'Invitando…' : 'Invitar'}
          </Button>
          {message && (
            <Notice tone={message.tone} className="sm:basis-full">
              {message.text}
            </Notice>
          )}
        </form>
      )}
    </Card>
  );
}
