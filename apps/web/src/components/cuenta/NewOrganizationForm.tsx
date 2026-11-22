'use client';

import { Button, Card, Field, Input, Notice } from '@team27/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { buttonLink } from '@/components/common/link-styles';
import { Empty, LoadError, Loading } from '@/components/common/LoadState';
import { useResource } from '@/hooks/use-resource';
import {
  canCreateOrganization,
  createOrganization,
  getMe,
} from '@/lib/accounts-api';
import { describeError } from '@/lib/http';

export function NewOrganizationForm() {
  const me = useResource((signal) => getMe(signal), 'me');
  if (me.error) return <LoadError message={me.error} />;
  if (!me.data) return <Loading />;
  if (!canCreateOrganization(me.data)) {
    return (
      <Empty>
        Solo un administrador puede crear organizaciones. Pídele a uno que la
        cree y te invite.
      </Empty>
    );
  }
  return <OrganizationForm />;
}

function OrganizationForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createOrganization(name);
      router.push('/cuenta');
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
        <Field label="Nombre">
          <Input
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Constructora Las Encinas"
          />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? 'Creando…' : 'Crear organización'}
          </Button>
          <Link href="/cuenta" className={buttonLink('secondary')}>
            Cancelar
          </Link>
        </div>
      </form>
    </Card>
  );
}
