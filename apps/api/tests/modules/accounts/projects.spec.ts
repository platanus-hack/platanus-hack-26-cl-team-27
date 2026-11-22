import {
  organizationBody,
  projectBody,
} from '../../../src/modules/accounts/accounts.controller.ts';
import {
  freeId,
  nameKey,
  organizationSlug,
  projectSlug,
} from '../../../src/modules/accounts/project-id.ts';

describe('nameKey', () => {
  it('no distingue mayúsculas, tildes ni espacios de más', () => {
    expect(nameKey('  Edificio  Las Éncinas ')).toBe(
      nameKey('edificio las encinas'),
    );
    expect(nameKey('Torre Sur')).not.toBe(nameKey('Torre Norte'));
  });
});

describe('projectSlug', () => {
  it.each([
    ['Edificio Los Aromos', 'edificio-los-aromos'],
    ['  Ñuñoa · Torre Pío XII ', 'nunoa-torre-pio-xii'],
    ['¡¡!!', 'proyecto'],
    ['a'.repeat(80), 'a'.repeat(56)],
  ])('%s', (name, slug) => {
    expect(projectSlug(name)).toBe(slug);
  });
});

describe('organizationSlug', () => {
  it('arma el id con el nombre, o «organizacion» si no queda nada', () => {
    expect(organizationSlug('Constructora Sur Ltda.')).toBe(
      'constructora-sur-ltda',
    );
    expect(organizationSlug('¡¡!!')).toBe('organizacion');
  });
});

describe('freeId', () => {
  it('usa el slug si está libre y si no, el primer sufijo libre', () => {
    expect(freeId('torre', ['los-aromos'])).toBe('torre');
    expect(freeId('torre', ['torre', 'torre-2', 'torre-4'])).toBe('torre-3');
  });
});

describe('projectBody', () => {
  it('recorta los textos y deja vacíos el lugar y la descripción', () => {
    expect(
      projectBody.parse({ organizationId: 'aromos', name: '  Torre Sur ' }),
    ).toEqual({
      organizationId: 'aromos',
      name: 'Torre Sur',
      location: '',
      description: '',
    });
  });

  it.each([
    [{ organizationId: 'aromos', name: '   ' }],
    [{ organizationId: '', name: 'Torre' }],
    [{ organizationId: 'aromos', name: 'x'.repeat(121) }],
    [{ organizationId: 'aromos', name: 'Torre', location: 3 }],
  ])('rechaza %j', (body) => {
    expect(projectBody.safeParse(body).success).toBe(false);
  });
});

describe('organizationBody', () => {
  it('recorta el nombre', () => {
    expect(organizationBody.parse({ name: '  Constructora Sur ' })).toEqual({
      name: 'Constructora Sur',
    });
  });

  it.each([[{ name: '   ' }], [{ name: 'x'.repeat(121) }], [{}]])(
    'rechaza %j',
    (body) => {
      expect(organizationBody.safeParse(body).success).toBe(false);
    },
  );
});
