'use client';

import { Button, Card, Field, Input, Notice } from '@team27/ui';
import { type FormEvent, useState } from 'react';

import { Empty, LoadError, Loading } from '@/components/common/LoadState';
import { type AdminOrganization, createOrganization } from '@/lib/admin-api';
import { describeError } from '@/lib/http';

const count = (value: number, one: string, many: string) =>
  `${value} ${value === 1 ? one : many}`;

export function OrganizationsCard({
  organizations,
  error,
  onCreated,
}: {
  readonly organizations: readonly AdminOrganization[] | null;
  readonly error: string | null;
  readonly onCreated: () => void;
}) {
  return (
    <Card
      title="Organizaciones"
      description="Cada cliente es una organización, con sus proyectos y su equipo."
    >
      {error && <LoadError message={error} />}
      {!organizations && !error && <Loading />}
      {organizations?.length === 0 && (
        <Empty>Todavía no hay organizaciones.</Empty>
      )}
      {organizations && organizations.length > 0 && (
        <ul className="flex flex-col gap-2">
          {organizations.map((organization) => (
            <li
              key={organization.id}
              className="flex flex-wrap justify-between gap-x-4"
            >
              <span className="font-medium text-ink">{organization.name}</span>
              <span className="text-sm text-ink-2">
                {count(organization.members, 'miembro', 'miembros')} ·{' '}
                {count(organization.projects, 'proyecto', 'proyectos')}
              </span>
            </li>
          ))}
        </ul>
      )}
      <CreateOrganizationForm onCreated={onCreated} />
    </Card>
  );
}

function CreateOrganizationForm({
  onCreated,
}: {
  readonly onCreated: () => void;
}) {
  const [name, setName] = useState('');
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
      const organization = await createOrganization(name);
      setMessage({
        tone: 'success',
        text: `Creamos ${organization.name}. Ahora invita a su primer administrador.`,
      });
      setName('');
      onCreated();
    } catch (error) {
      setMessage({ tone: 'error', text: describeError(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mt-4 flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <Field label="Nombre de la organización" className="flex-1">
        <Input
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Constructora Andes"
        />
      </Field>
      <Button type="submit" disabled={busy}>
        {busy ? 'Creando…' : 'Crear organización'}
      </Button>
      {message && (
        <Notice tone={message.tone} className="sm:basis-full">
          {message.text}
        </Notice>
      )}
    </form>
  );
}
