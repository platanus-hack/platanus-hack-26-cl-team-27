'use client';

import { Button, Card, Field, Input, Notice, PageHeader } from '@team27/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';

import { Icon } from '@/components/common/Icon';
import { buttonLink } from '@/components/common/link-styles';
import { LoadError, Loading } from '@/components/common/LoadState';
import { useResource } from '@/hooks/use-resource';
import {
  getProject,
  getTeam,
  type ProjectDetail,
  updateProject,
} from '@/lib/accounts-api';
import { formatDate } from '@/lib/format';
import { describeError } from '@/lib/http';
import { projectPage } from '@/lib/project-paths';

import { TeamCard } from './TeamCard';

const dataLabel = 'flex items-center gap-1.5 text-sm text-ink-2';

const TEXTAREA =
  'min-h-24 w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent';

export function ProjectView({ projectId }: { readonly projectId: string }) {
  const [version, setVersion] = useState(0);
  const project = useResource(
    (signal) => getProject(projectId, signal),
    `${projectId}:${version}`,
  );
  const team = useResource(
    (signal) => getTeam(projectId, signal),
    `${projectId}:team:${version}`,
  );
  const [editing, setEditing] = useState(false);

  if (project.error) {
    return (
      <>
        <PageHeader title="Proyecto" />
        <LoadError message={project.error} />
      </>
    );
  }
  if (!project.data) return <Loading />;
  const canManage = team.data?.canManage ?? false;
  const reload = () => setVersion((value) => value + 1);

  return (
    <>
      <PageHeader
        title={project.data.name}
        description={project.data.organizationName}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={projectPage(projectId, '/archivos') as Route}
              className={buttonLink('primary', 'sm')}
            >
              <Icon name="sheet" />
              Archivos
            </Link>
            <Link
              href={projectPage(projectId, '/espacios') as Route}
              className={buttonLink('secondary', 'sm')}
            >
              <Icon name="layers" />
              Espacios
            </Link>
            <Link href="/cuenta" className={buttonLink('secondary', 'sm')}>
              <Icon name="project" />
              Tus proyectos
            </Link>
          </div>
        }
      />
      <div className="flex flex-col gap-4">
        {editing ? (
          <ProjectEditForm
            project={project.data}
            onSaved={() => {
              setEditing(false);
              reload();
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <ProjectData
            project={project.data}
            onEdit={canManage ? () => setEditing(true) : null}
          />
        )}
        <TeamCard
          projectId={projectId}
          organizationId={project.data.organizationId}
          team={team.data}
          error={team.error}
          onChange={reload}
        />
        <Notice>
          Este proyecto todavía no tiene documentos ni mapa de dependencias:
          cuando los tenga, sus cambios se van a avisar a quien afecten en su
          equipo.
        </Notice>
      </div>
    </>
  );
}

function ProjectData({
  project,
  onEdit,
}: {
  readonly project: ProjectDetail;
  readonly onEdit: (() => void) | null;
}) {
  return (
    <Card
      title="Datos del proyecto"
      actions={
        onEdit && (
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Icon name="pencil" />
            Editar
          </Button>
        )
      }
    >
      <dl className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <dt className={dataLabel}>
          <Icon name="mapPin" className="text-accent-text" />
          Lugar
        </dt>
        <dd className="text-ink">{project.location || 'Sin lugar todavía'}</dd>
        <dt className={dataLabel}>
          <Icon name="file" className="text-accent-text" />
          Descripción
        </dt>
        <dd className="text-ink">
          {project.description || 'Sin descripción todavía'}
        </dd>
        <dt className={dataLabel}>
          <Icon name="calendar" className="text-accent-text" />
          Creado
        </dt>
        <dd className="text-ink">{formatDate(project.createdAt)}</dd>
      </dl>
    </Card>
  );
}

function ProjectEditForm({
  project,
  onSaved,
  onCancel,
}: {
  readonly project: ProjectDetail;
  readonly onSaved: () => void;
  readonly onCancel: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [location, setLocation] = useState(project.location);
  const [description, setDescription] = useState(project.description);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateProject(project.id, { name, location, description });
      onSaved();
    } catch (failure) {
      setError(describeError(failure));
      setBusy(false);
    }
  };

  return (
    <Card title="Editar el proyecto">
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
          />
        </Field>
        <Field label="Lugar" hint="Opcional">
          <Input
            maxLength={200}
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </Field>
        <Field label="Descripción" hint="Opcional">
          <textarea
            className={TEXTAREA}
            maxLength={1000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
