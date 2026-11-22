import type { OrganizationDef } from '../project/definition.ts';

export const CORDILLERA: OrganizationDef = {
  id: 'constructora-cordillera',
  name: 'Constructora Cordillera',
};

export const DUMMY_DOMAIN = 'cordillera.test';

export interface SeedPerson {
  readonly tag: string;
  readonly local: string;
  readonly role: 'admin' | 'member';
}

export const PEOPLE: readonly SeedPerson[] = [
  { tag: 'admin', local: 'admin', role: 'admin' },
  { tag: 'ana', local: 'ana.soto', role: 'member' },
  { tag: 'bruno', local: 'bruno.diaz', role: 'member' },
  { tag: 'carla', local: 'carla.mena', role: 'member' },
  { tag: 'diego', local: 'diego.fuentes', role: 'member' },
  { tag: 'elena', local: 'elena.parra', role: 'member' },
];

export const emailOf = (
  person: SeedPerson,
  base: string | undefined,
): string => {
  const at = base?.lastIndexOf('@') ?? -1;
  if (base === undefined || at <= 0) {
    return `${person.local}@${DUMMY_DOMAIN}`;
  }
  return `${base.slice(0, at)}+${person.tag}${base.slice(at)}`.toLowerCase();
};
