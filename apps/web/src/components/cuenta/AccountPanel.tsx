'use client';

import { Button, Card } from '@team27/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { buttonLink, textLink } from '@/components/common/link-styles';
import { Empty, LoadError, Loading } from '@/components/common/LoadState';
import { useResource } from '@/hooks/use-resource';
import { ADMIN_HREF } from '@/lib/admin-api';
import {
  canCreateOrganization,
  deleteOrganization,
  getMe,
  getProjects,
  NEW_ORGANIZATION_HREF,
  newProjectHref,
  type Organization,
  projectHref,
  projectsByOrganization,
  ROLE_LABELS,
} from '@/lib/accounts-api';
import { describeError } from '@/lib/http';

import { AutodeskCard } from './AutodeskCard';
import { MembersCard } from './MembersCard';

export function AccountPanel() {
  const [version, setVersion] = useState(0);
  const [removing, setRemoving] = useState<Organization | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const account = useResource(async (signal) => {
    const [me, { projects }] = await Promise.all([
      getMe(signal),
      getProjects(signal),
    ]);
    return { me, organizations: projectsByOrganization(me, projects) };
  }, `account:${version}`);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setError(null);
    try {
      await deleteOrganization(removing.id);
      setRemoving(null);
      setVersion((value) => value + 1);
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  };

  if (account.error) return <LoadError message={account.error} />;
  if (!account.data) return <Loading />;
  const { me, organizations } = account.data;
  const admin = me.superadmin && (
    <Card
      title="Administración de Vigente"
      description="Eres superadmin: ves a todos los usuarios, creas organizaciones e invitas a sus equipos."
    >
      <Link href={ADMIN_HREF as Route} className={buttonLink('primary', 'sm')}>
        Abrir la administración
      </Link>
    </Card>
  );
  return (
    <div className="flex flex-col gap-6">
      {admin}
      {organizations.length === 0 && (
        <Empty>
          Como superadmin entras sin organización. Invita a quien quieras desde
          la administración.
        </Empty>
      )}
      {canCreateOrganization(me) && (
        <div className="flex justify-end">
          <Link
            href={NEW_ORGANIZATION_HREF as Route}
            className={buttonLink('secondary', 'sm')}
          >
            Crear organización
          </Link>
        </div>
      )}
      {organizations.map((organization) => (
        <section key={organization.id} className="flex flex-col gap-4">
          <Card
            title={organization.name}
            description={`Tu rol: ${ROLE_LABELS[organization.role]}`}
            actions={
              <div className="flex flex-wrap gap-2">
                <Link
                  href={newProjectHref(organization.id) as Route}
                  className={buttonLink('secondary', 'sm')}
                >
                  Crear proyecto
                </Link>
                {organization.role === 'admin' && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setError(null);
                      setRemoving(organization);
                    }}
                  >
                    Eliminar
                  </Button>
                )}
              </div>
            }
          >
            {organization.projects.length === 0 ? (
              <Empty>
                Esta organización todavía no tiene proyectos. Crea el primero.
              </Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {organization.projects.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={projectHref(project.id) as Route}
                      className={textLink}
                    >
                      {project.name}
                    </Link>
                    <p className="text-sm text-ink-2">
                      {[project.location, project.description]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <AutodeskCard
            organizationId={organization.id}
            canManage={organization.role === 'admin'}
          />
          <MembersCard
            organizationId={organization.id}
            canInvite={organization.role === 'admin'}
          />
        </section>
      ))}
      {removing && (
        <ConfirmDialog
          title={`Eliminar «${removing.name}»`}
          confirmLabel="Eliminar"
          busyLabel="Eliminando…"
          busy={busy}
          error={error}
          onConfirm={() => void remove()}
          onCancel={() => setRemoving(null)}
        >
          Se borran su equipo, sus invitaciones pendientes y su conexión con
          Autodesk. No se puede deshacer.
        </ConfirmDialog>
      )}
    </div>
  );
}
