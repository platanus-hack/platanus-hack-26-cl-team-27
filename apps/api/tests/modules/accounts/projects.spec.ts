import { projectBody } from '../../../src/modules/accounts/accounts.controller.ts';
import {
  freeProjectId,
  projectNameKey,
  projectSlug,
} from '../../../src/modules/accounts/project-id.ts';

describe('projectNameKey', () => {
  it('no distingue mayúsculas, tildes ni espacios de más', () => {
    expect(projectNameKey('  Edificio  Las Éncinas ')).toBe(
      projectNameKey('edificio las encinas'),
    );
    expect(projectNameKey('Torre Sur')).not.toBe(projectNameKey('Torre Norte'));
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

describe('freeProjectId', () => {
  it('usa el slug si está libre y si no, el primer sufijo libre', () => {
    expect(freeProjectId('torre', ['los-aromos'])).toBe('torre');
    expect(freeProjectId('torre', ['torre', 'torre-2', 'torre-4'])).toBe(
      'torre-3',
    );
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
