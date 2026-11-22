import { describe, expect, it } from 'vitest';

import {
  type AdminUsers,
  describeAdminError,
  filterAdminUsers,
} from './admin-api';
import { ApiError, describeError } from './http';

const data: AdminUsers = {
  users: [
    {
      id: 'u1',
      email: 'paula.rojas@calculo.example',
      name: 'Paula Rojas',
      createdAt: '2026-01-01',
      organizations: [],
    },
    {
      id: 'u2',
      email: 'jose@andes.example',
      name: 'José Núñez',
      createdAt: '2026-01-02',
      organizations: [],
    },
    {
      id: 'u3',
      email: 'anonimo@andes.example',
      name: null,
      createdAt: '2026-01-03',
      organizations: [],
    },
  ],
  invitations: [
    {
      id: 'i1',
      email: 'nueva@andes.example',
      organizationId: 'andes',
      organizationName: 'Constructora Andes',
      role: 'admin',
      createdAt: '2026-01-04',
    },
  ],
};

describe('filterAdminUsers', () => {
  it('sin búsqueda deja todo', () => {
    expect(filterAdminUsers(data, '  ')).toEqual(data);
  });

  it('busca por nombre sin importar tildes ni mayúsculas', () => {
    const result = filterAdminUsers(data, 'nunez');
    expect(result.users.map((user) => user.id)).toEqual(['u2']);
    expect(result.invitations).toEqual([]);
  });

  it('busca por correo, también en las invitaciones pendientes', () => {
    const result = filterAdminUsers(data, 'ANDES.example');
    expect(result.users.map((user) => user.id)).toEqual(['u2', 'u3']);
    expect(result.invitations.map((item) => item.id)).toEqual(['i1']);
  });
});

describe('describeError de administración', () => {
  it.each([
    [
      'superadmin_required',
      403,
      'Solo un superadmin de Vigente puede administrar la plataforma.',
    ],
    ['organization_not_found', 404, 'Esa organización no existe.'],
  ])('%s', (code, status, text) => {
    expect(describeError(new ApiError(status, code, 'x'))).toBe(text);
  });

  it('un nombre tomado se explica para toda la plataforma, no para tus organizaciones', () => {
    const taken = new ApiError(409, 'organization_name_taken', 'x');
    expect(describeAdminError(taken)).toBe(
      'Ya existe una organización con ese nombre en Vigente. Elige otro.',
    );
    expect(
      describeAdminError(new ApiError(404, 'organization_not_found', 'x')),
    ).toBe(describeError(new ApiError(404, 'organization_not_found', 'x')));
  });
});
