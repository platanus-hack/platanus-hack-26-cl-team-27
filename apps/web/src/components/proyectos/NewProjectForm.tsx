'use client';

import { Button, Card, Field, Input, Notice, Select } from '@team27/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { buttonLink } from '@/components/common/link-styles';
import { LoadError, Loading } from '@/components/common/LoadState';
import { useResource } from '@/hooks/use-resource';
import {
  createProject,
  getMe,
  initialOrganization,
  type Me,
  projectHref,
} from '@/lib/accounts-api';
import { describeError } from '@/lib/http';

const TEXTAREA =
  'min-h-24 w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent';

export function NewProjectForm({
  requestedOrganization,
}: {
  readonly requestedOrganization: string | null;
}) {
  const me = useResource((signal) => getMe(signal), 'me');
  if (me.error) return <LoadError message={me.error} />;
  if (!me.data) return <Loading />;
  return (
    <ProjectForm
      me={me.data}
      organizationId={initialOrganization(me.data, requestedOrganization)}
    />
  );
}

function ProjectForm({
  me,
  organizationId: initial,
}: {
  readonly me: Me;
  readonly organizationId: string | null;
}) {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState(initial ?? '');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const project = await createProject({
        organizationId,
        name,
        location,
        description,
      });
      router.push(projectHref(project.id) as Route);
    } catch (failure) {
      setError(describeError(failure));
      setBusy(false);
    }
  };

  return (
    <Card>
      <form
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-4"
      >
        {me.organizations.length > 1 && (
          <Field label="Organización">
            <Select
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
            >
              {me.organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Nombre">
          <Input
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Edificio Las Encinas"
          />
        </Field>
        <Field label="Lugar" hint="Opcional">
          <Input
            maxLength={200}
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Av. Grecia 1450, Ñuñoa"
          />
        </Field>
        <Field label="Descripción" hint="Opcional">
          <textarea
            className={TEXTAREA}
            maxLength={1000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Edificio de 8 pisos y 2 subterráneos"
          />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? 'Creando…' : 'Crear proyecto'}
          </Button>
          <Link href="/cuenta" className={buttonLink('secondary')}>
            Cancelar
          </Link>
        </div>
      </form>
    </Card>
  );
}
