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
