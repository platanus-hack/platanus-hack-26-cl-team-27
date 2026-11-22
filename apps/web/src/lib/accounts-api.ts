import { request } from './http';

export type Role = 'admin' | 'member';

export interface Me {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly name: string | null;
  };
  readonly organizations: readonly {
    readonly id: string;
    readonly name: string;
    readonly role: Role;
  }[];
}

export interface AccountProject {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly location: string;
  readonly description: string;
}

export interface Members {
  readonly members: readonly {
    readonly userId: string;
    readonly email: string;
    readonly name: string | null;
    readonly role: Role;
  }[];
  readonly invitations: readonly {
    readonly id: string;
    readonly email: string;
    readonly role: Role;
    readonly createdAt: string;
  }[];
}

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  admin: 'Administrador',
  member: 'Miembro',
};

export const getMe = (signal?: AbortSignal) =>
  request<Me>('/api/me', { signal });

export const getProjects = (signal?: AbortSignal) =>
  request<{ projects: AccountProject[] }>('/api/projects', { signal });

export const getMembers = (organizationId: string, signal?: AbortSignal) =>
  request<Members>(
    `/api/organizations/${encodeURIComponent(organizationId)}/members`,
    { signal },
  );

export const inviteMember = (
  organizationId: string,
  email: string,
  role: Role,
) =>
  request<Members['invitations'][number]>(
    `/api/organizations/${encodeURIComponent(organizationId)}/invitations`,
    { method: 'POST', body: { email, role } },
  );

export const projectsByOrganization = (
  me: Me,
  projects: readonly AccountProject[],
) =>
  me.organizations.map((organization) => ({
    ...organization,
    projects: projects.filter(
      (project) => project.organizationId === organization.id,
    ),
  }));

export interface NewProject {
  readonly organizationId: string;
  readonly name: string;
  readonly location: string;
  readonly description: string;
}

export interface ProjectDetail extends AccountProject {
  readonly organizationName: string;
  readonly createdAt: string;
}

export const projectHref = (projectId: string): string =>
  `/proyectos/${encodeURIComponent(projectId)}`;

export const newProjectHref = (organizationId?: string): string =>
  organizationId
    ? `/proyectos/nuevo?organizacion=${encodeURIComponent(organizationId)}`
    : '/proyectos/nuevo';

export const getProject = (projectId: string, signal?: AbortSignal) =>
  request<ProjectDetail>(`/api/projects/${encodeURIComponent(projectId)}`, {
    signal,
  });

export const createProject = (project: NewProject) =>
  request<AccountProject>('/api/projects', {
    method: 'POST',
    body: {
      organizationId: project.organizationId,
      name: project.name.trim(),
      location: project.location.trim(),
      description: project.description.trim(),
    },
  });

export const initialOrganization = (
  me: Me,
  requested: string | null,
): string | null =>
  me.organizations.find((organization) => organization.id === requested)?.id ??
  me.organizations[0]?.id ??
  null;
