import { describe, expect, it } from 'vitest';

import {
  type AccountProject,
  canCreateOrganization,
  type Me,
  projectsByOrganization,
} from './accounts-api';
import { ApiError, describeError } from './http';

const me: Me = {
  user: { id: 'u1', email: 'paula@calculo.example', name: 'Paula' },
  superadmin: false,
  organizations: [
    { id: 'aromos', name: 'Inmobiliaria Los Aromos', role: 'admin' },
    { id: 'vacia', name: 'Sin proyectos', role: 'member' },
  ],
};

const project = (id: string, organizationId: string): AccountProject => ({
  id,
  organizationId,
  name: id,
  location: '',
  description: '',
});

describe('projectsByOrganization', () => {
  it('agrupa los proyectos bajo cada organización, también las vacías', () => {
    const grouped = projectsByOrganization(me, [
      project('los-aromos', 'aromos'),
      project('torre', 'aromos'),
    ]);
    expect(
      grouped.map((item) => [item.id, item.role, item.projects.length]),
    ).toEqual([
      ['aromos', 'admin', 2],
      ['vacia', 'member', 0],
    ]);
  });
});

describe('canCreateOrganization', () => {
  it('solo quien administra alguna organización crea otra', () => {
    expect(canCreateOrganization(me)).toBe(true);
    expect(
      canCreateOrganization({
        ...me,
        organizations: [{ id: 'vacia', name: 'Sin proyectos', role: 'member' }],
      }),
    ).toBe(false);
  });
});

describe('describeError de cuentas', () => {
  it.each([
    ['invalid_token', 401, 'Tu sesión venció. Vuelve a entrar.'],
    [
      'not_invited',
      403,
      'Tu correo no tiene una invitación. Pídele a un administrador de tu organización que te invite y vuelve a entrar.',
    ],
    [
      'admin_required',
      403,
      'Solo un administrador de la organización puede invitar.',
    ],
    ['already_member', 409, 'Esa persona ya es parte de la organización.'],
    [
      'organization_name_taken',
      409,
      'Ya eres parte de una organización con ese nombre. Elige otro.',
    ],
    [
      'organization_has_projects',
      409,
      'La organización tiene proyectos, así que no se puede eliminar.',
    ],
    [
      'last_organization',
      409,
      'Es tu única organización: si la eliminas, te quedas sin acceso.',
    ],
  ])('%s', (code, status, text) => {
    expect(describeError(new ApiError(status, code, 'x'))).toBe(text);
  });
});
