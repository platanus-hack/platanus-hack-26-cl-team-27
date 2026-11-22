import type { Me } from './accounts-api';

export interface NavLink {
  readonly href: '/conectores' | '/admin' | '/cuenta';
  readonly label: string;
}

const CONNECTORS: NavLink = { href: '/conectores', label: 'Conectores' };
const ADMIN: NavLink = { href: '/admin', label: 'Admin' };
const ACCOUNT: NavLink = { href: '/cuenta', label: 'Cuenta' };

export const navLinks = (me: Me | null): readonly NavLink[] => [
  ...(me && me.organizations.length > 0 ? [CONNECTORS] : []),
  ...(me?.superadmin ? [ADMIN] : []),
  ACCOUNT,
];
