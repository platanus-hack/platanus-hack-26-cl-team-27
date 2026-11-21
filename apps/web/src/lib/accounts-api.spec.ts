import { describe, expect, it } from 'vitest';

import {
  type AccountProject,
  type Me,
  projectsByOrganization,
} from './accounts-api';
import { ApiError, describeError } from './http';

const me: Me = {
  user: { id: 'u1', email: 'paula@calculo.example', name: 'Paula' },
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

describe('describeError de cuentas', () => {
  it.each([
    ['invalid_token', 401, 'Tu sesión venció. Vuelve a entrar.'],
    [
      'admin_required',
      403,
      'Solo un administrador de la organización puede invitar.',
    ],
    ['already_member', 409, 'Esa persona ya es parte de la organización.'],
  ])('%s', (code, status, text) => {
    expect(describeError(new ApiError(status, code, 'x'))).toBe(text);
  });
});
