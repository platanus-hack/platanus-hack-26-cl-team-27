import { describe, expect, it } from 'vitest';

import type { Me } from './accounts-api';
import { navLinks } from './nav';

const me = (overrides: Partial<Me> = {}): Me => ({
  user: { id: 'u1', email: 'ana@example.com', name: 'Ana' },
  superadmin: false,
  organizations: [],
  ...overrides,
});

const cordillera = {
  id: 'constructora-cordillera',
  name: 'Constructora Cordillera',
  role: 'member' as const,
};

const labels = (value: Me | null) => navLinks(value).map((link) => link.label);

describe('navLinks', () => {
  it('mientras no sabe quién eres, solo muestra Cuenta', () => {
    expect(labels(null)).toEqual(['Cuenta']);
  });

  it('un member o un admin de una organización ve Conectores', () => {
    expect(labels(me({ organizations: [cordillera] }))).toEqual([
      'Conectores',
      'Cuenta',
    ]);
    expect(
      labels(me({ organizations: [{ ...cordillera, role: 'admin' }] })),
    ).toEqual(['Conectores', 'Cuenta']);
  });

  it('un superadmin sin organizaciones ve Admin y no Conectores', () => {
    expect(labels(me({ superadmin: true }))).toEqual(['Admin', 'Cuenta']);
  });

  it('un superadmin que es de una organización ve las dos', () => {
    expect(
      labels(me({ superadmin: true, organizations: [cordillera] })),
    ).toEqual(['Conectores', 'Admin', 'Cuenta']);
  });
});
