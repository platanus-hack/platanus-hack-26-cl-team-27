import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createProject,
  initialOrganization,
  type Me,
  newProjectHref,
  projectHref,
} from './accounts-api';

const me: Me = {
  user: { id: 'u1', email: 'paula@calculo.example', name: 'Paula' },
  superadmin: false,
  organizations: [
    { id: 'aromos', name: 'Inmobiliaria Los Aromos', role: 'admin' },
    { id: 'encinas', name: 'Constructora Las Encinas', role: 'member' },
  ],
};

describe('rutas de proyectos', () => {
  it('arma la ruta del proyecto y la del formulario, con o sin organización', () => {
    expect(projectHref('los-aromos')).toBe('/proyectos/los-aromos');
    expect(newProjectHref()).toBe('/proyectos/nuevo');
    expect(newProjectHref('aromos')).toBe(
      '/proyectos/nuevo?organizacion=aromos',
    );
  });
});

describe('initialOrganization', () => {
  it('usa la organización pedida si es tuya y si no, la primera', () => {
    expect(initialOrganization(me, 'encinas')).toBe('encinas');
    expect(initialOrganization(me, 'ajena')).toBe('aromos');
    expect(initialOrganization(me, null)).toBe('aromos');
    expect(initialOrganization({ ...me, organizations: [] }, null)).toBeNull();
  });
});

describe('createProject', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('envía los datos recortados por POST a /api/projects', async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: 'torre-sur' }), { status: 201 }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const created = await createProject({
      organizationId: 'aromos',
      name: '  Torre Sur ',
      location: ' Ñuñoa ',
      description: '',
    });
    expect(created).toEqual({ id: 'torre-sur' });
    const [path, init] = fetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(path).toBe('/api/projects');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      organizationId: 'aromos',
      name: 'Torre Sur',
      location: 'Ñuñoa',
      description: '',
    });
  });
});
