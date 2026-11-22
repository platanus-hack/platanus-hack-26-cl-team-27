import type { Role } from './accounts-api';
import { request } from './http';

export interface AdminUser {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly createdAt: string;
  readonly organizations: readonly {
    readonly id: string;
    readonly name: string;
    readonly role: Role;
  }[];
}

export interface AdminInvitation {
  readonly id: string;
  readonly email: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly role: Role;
  readonly createdAt: string;
}

export interface AdminOrganization {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly members: number;
  readonly projects: number;
}

export interface AdminUsers {
  readonly users: readonly AdminUser[];
  readonly invitations: readonly AdminInvitation[];
}

export const getAdminUsers = (signal?: AbortSignal) =>
  request<AdminUsers>('/api/admin/users', { signal });

export const getAdminOrganizations = (signal?: AbortSignal) =>
  request<{ organizations: AdminOrganization[] }>('/api/admin/organizations', {
    signal,
  });

export const createOrganization = (name: string) =>
  request<AdminOrganization>('/api/admin/organizations', {
    method: 'POST',
    body: { name },
  });

export const inviteToOrganization = (
  organizationId: string,
  email: string,
  role: Role,
) =>
  request<AdminInvitation>('/api/admin/invitations', {
    method: 'POST',
    body: { organizationId, email, role },
  });

const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

export const filterAdminUsers = (
  { users, invitations }: AdminUsers,
  query: string,
): AdminUsers => {
  const needle = fold(query);
  if (!needle) return { users, invitations };
  const matches = (...texts: (string | null)[]) =>
    texts.some((text) => text !== null && fold(text).includes(needle));
  return {
    users: users.filter((user) => matches(user.name, user.email)),
    invitations: invitations.filter((invitation) => matches(invitation.email)),
  };
};
