'use client';

import { Card, Notice, PageHeader } from '@team27/ui';
import type { Route } from 'next';
import Link from 'next/link';

import { buttonLink } from '@/components/common/link-styles';
import { LoadError, Loading } from '@/components/common/LoadState';
import { useResource } from '@/hooks/use-resource';
import { getProject } from '@/lib/accounts-api';
import { formatDate } from '@/lib/format';
import { projectPage } from '@/lib/project-paths';

export function ProjectView({ projectId }: { readonly projectId: string }) {
  const project = useResource(
    (signal) => getProject(projectId, signal),
    projectId,
  );
  if (project.error) {
    return (
      <>
        <PageHeader title="Proyecto" />
        <LoadError message={project.error} />
      </>
    );
  }
  if (!project.data) return <Loading />;
  const { name, location, description, organizationName, createdAt } =
    project.data;
  return (
    <>
      <PageHeader
        title={name}
        description={organizationName}
        actions={
          <>
            <Link
              href={projectPage(projectId, '/espacios') as Route}
              className={buttonLink('primary', 'sm')}
            >
              Espacios
            </Link>
            <Link href="/cuenta" className={buttonLink('secondary', 'sm')}>
              Tus proyectos
            </Link>
          </>
        }
      />
      <div className="flex flex-col gap-4">
        <Card title="Datos del proyecto">
          <dl className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <dt className="text-sm text-ink-2">Lugar</dt>
            <dd className="text-ink">{location || 'Sin lugar todavía'}</dd>
            <dt className="text-sm text-ink-2">Descripción</dt>
            <dd className="text-ink">
              {description || 'Sin descripción todavía'}
            </dd>
            <dt className="text-sm text-ink-2">Creado</dt>
            <dd className="text-ink">{formatDate(createdAt)}</dd>
          </dl>
        </Card>
        <Notice>
          Este proyecto todavía no tiene documentos, equipo ni mapa de
          dependencias: cuando los tenga, sus cambios se van a avisar a quien
          afecten.
        </Notice>
      </div>
    </>
  );
}
