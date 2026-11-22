import { request } from './http';

export type Role = 'admin' | 'member';

export interface Me {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly name: string | null;
  };
  readonly superadmin: boolean;
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

export type Organization = Me['organizations'][number];

export const NEW_ORGANIZATION_HREF = '/organizaciones/nueva';

export const canCreateOrganization = (me: Me): boolean =>
  me.organizations.some((organization) => organization.role === 'admin');

export const createOrganization = (name: string) =>
  request<Organization>('/api/organizations', {
    method: 'POST',
    body: { name: name.trim() },
  });

export const deleteOrganization = (organizationId: string) =>
  request<void>(`/api/organizations/${encodeURIComponent(organizationId)}`, {
    method: 'DELETE',
  });

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

export interface ProjectChanges {
  readonly name: string;
  readonly location: string;
  readonly description: string;
}

export const updateProject = (projectId: string, changes: ProjectChanges) =>
  request<ProjectDetail>(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    body: {
      name: changes.name.trim(),
      location: changes.location.trim(),
      description: changes.description.trim(),
    },
  });

export interface TeamMember {
  readonly userId: string;
  readonly name: string;
  readonly role: string;
  readonly email: string;
  readonly author: boolean;
}

export interface ProjectTeam {
  readonly canManage: boolean;
  readonly members: readonly TeamMember[];
}

const teamPath = (projectId: string) =>
  `/api/projects/${encodeURIComponent(projectId)}/team`;

export const getTeam = (projectId: string, signal?: AbortSignal) =>
  request<ProjectTeam>(teamPath(projectId), { signal });

export const addToTeam = (projectId: string, userId: string, role: string) =>
  request<TeamMember>(teamPath(projectId), {
    method: 'POST',
    body: role.trim() ? { userId, role: role.trim() } : { userId },
  });

export const removeFromTeam = (projectId: string, userId: string) =>
  request<void>(`${teamPath(projectId)}/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });

export const teamCandidates = (
  members: Members['members'],
  team: readonly TeamMember[],
): Members['members'] => {
  const inTeam = new Set(team.map((member) => member.userId));
  return members.filter((member) => !inTeam.has(member.userId));
};

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
