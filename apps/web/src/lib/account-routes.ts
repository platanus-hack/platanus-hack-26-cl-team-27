export const AUTH0_SCOPE = 'openid profile email offline_access';

const REQUIRED = [
  'AUTH0_DOMAIN',
  'AUTH0_CLIENT_ID',
  'AUTH0_CLIENT_SECRET',
  'AUTH0_SECRET',
  'AUTH0_AUDIENCE',
] as const;

export const authConfigured = (
  env: Readonly<Record<string, string | undefined>>,
): boolean => REQUIRED.every((name) => Boolean(env[name]?.trim()));

const ACCOUNT_API = ['/api/me', '/api/projects', '/api/organizations'];

export const needsAccountToken = (pathname: string): boolean =>
  ACCOUNT_API.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

export const loginHref = (returnTo: string): string =>
  `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

export const LOGOUT_HREF = '/auth/logout';
