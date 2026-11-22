'use client';

import { Card } from '@team27/ui';
import type { Route } from 'next';
import Link from 'next/link';

import { buttonLink, textLink } from '@/components/common/link-styles';
import { Empty, LoadError, Loading } from '@/components/common/LoadState';
import { useResource } from '@/hooks/use-resource';
import {
  getMe,
  getProjects,
  newProjectHref,
  projectHref,
  projectsByOrganization,
  ROLE_LABELS,
} from '@/lib/accounts-api';

import { AutodeskCard } from './AutodeskCard';
import { MembersCard } from './MembersCard';

export function AccountPanel() {
  const account = useResource(async (signal) => {
    const [me, { projects }] = await Promise.all([
      getMe(signal),
      getProjects(signal),
    ]);
    return { me, organizations: projectsByOrganization(me, projects) };
  }, 'account');
  if (account.error) return <LoadError message={account.error} />;
  if (!account.data) return <Loading />;
  const { organizations } = account.data;
  if (organizations.length === 0) {
    return (
      <Empty>
        Todavía no eres parte de ninguna organización. Pídele a un administrador
        que invite tu correo y vuelve a entrar.
      </Empty>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {organizations.map((organization) => (
        <section key={organization.id} className="flex flex-col gap-4">
          <Card
            title={organization.name}
            description={`Tu rol: ${ROLE_LABELS[organization.role]}`}
            actions={
              <Link
                href={newProjectHref(organization.id) as Route}
                className={buttonLink('secondary', 'sm')}
              >
                Crear proyecto
              </Link>
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
    </div>
  );
}
