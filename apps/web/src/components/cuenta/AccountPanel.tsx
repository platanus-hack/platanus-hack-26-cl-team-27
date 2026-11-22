'use client';

import { Button, Card } from '@team27/ui';
import { ArrowUpRight, Building2, FolderKanban, MapPin, ShieldCheck } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { buttonLink } from '@/components/common/link-styles';
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
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-accent-text" />
          Administración de Vigente
        </span>
      }
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
        <section
          key={organization.id}
          className="grid grid-cols-1 gap-4 lg:grid-cols-2"
        >
          <Card
            className="lg:col-span-2"
            title={
              <span className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
                  <Building2 className="size-4" />
                </span>
                {organization.name}
              </span>
            }
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
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {organization.projects.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={projectHref(project.id) as Route}
                      className="group flex h-full items-start gap-3 rounded-xl border border-hairline bg-surface-2/50 p-4 transition hover:-translate-y-0.5 hover:border-accent-text hover:shadow-md"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
                        <FolderKanban className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 font-semibold text-ink">
                          <span className="truncate">{project.name}</span>
                          <ArrowUpRight className="size-4 shrink-0 text-ink-3 transition group-hover:text-accent-text" />
                        </span>
                        {project.location && (
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-2">
                            <MapPin className="size-3" />
                            {project.location}
                          </span>
                        )}
                        {project.description && (
                          <span className="mt-1 line-clamp-2 block text-xs text-ink-3">
                            {project.description}
                          </span>
                        )}
                      </span>
                    </Link>
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
