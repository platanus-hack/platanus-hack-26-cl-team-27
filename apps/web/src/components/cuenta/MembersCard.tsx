'use client';

import { Button, Card, Field, Input, Notice, Select } from '@team27/ui';
import { type FormEvent, useState } from 'react';

import { LoadError, Loading } from '@/components/common/LoadState';
import { useResource } from '@/hooks/use-resource';
import {
  getMembers,
  inviteMember,
  ROLE_LABELS,
  type Role,
} from '@/lib/accounts-api';
import { describeError } from '@/lib/http';

export function MembersCard({
  organizationId,
  canInvite,
}: {
  readonly organizationId: string;
  readonly canInvite: boolean;
}) {
  const [version, setVersion] = useState(0);
  const members = useResource(
    (signal) => getMembers(organizationId, signal),
    `${organizationId}:${version}`,
  );
  return (
    <Card title="Equipo">
      {members.error && <LoadError message={members.error} />}
      {!members.data && !members.error && <Loading />}
      {members.data && (
        <ul className="flex flex-col gap-2">
          {members.data.members.map((member) => (
            <li key={member.userId} className="flex justify-between gap-4">
              <span className="text-ink">{member.name ?? member.email}</span>
              <span className="text-sm text-ink-2">
                {ROLE_LABELS[member.role]}
              </span>
            </li>
          ))}
          {members.data.invitations.map((invitation) => (
            <li key={invitation.id} className="flex justify-between gap-4">
              <span className="text-ink-2">{invitation.email}</span>
              <span className="text-sm text-ink-2">
                Invitado como {ROLE_LABELS[invitation.role].toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canInvite && (
        <InviteForm
          organizationId={organizationId}
          onInvited={() => setVersion((value) => value + 1)}
        />
      )}
    </Card>
  );
}

function InviteForm({
  organizationId,
  onInvited,
}: {
  readonly organizationId: string;
  readonly onInvited: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const invitation = await inviteMember(organizationId, email, role);
      setMessage({
        tone: 'success',
        text: `Invitamos a ${invitation.email}. Entra con ese correo y queda en el equipo.`,
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
    <form
      onSubmit={(event) => void submit(event)}
      className="mt-4 flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:items-end"
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
      <Field label="Rol">
        <Select
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
        >
          <option value="member">{ROLE_LABELS.member}</option>
          <option value="admin">{ROLE_LABELS.admin}</option>
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
  );
}
