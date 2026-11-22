import { describe, expect, it } from 'vitest';

import { authConfigured, loginHref, needsAccountToken } from './account-routes';

const FULL = {
  AUTH0_DOMAIN: 'tenant.us.auth0.com',
  AUTH0_CLIENT_ID: 'id',
  AUTH0_CLIENT_SECRET: 'secret',
  AUTH0_SECRET: 'cookie-secret',
  AUTH0_AUDIENCE: 'https://api.vigente.local',
};

describe('authConfigured', () => {
  it('con las cinco variables, las cuentas están activas', () => {
    expect(authConfigured(FULL)).toBe(true);
  });

  it.each(Object.keys(FULL))('sin %s, no', (name) => {
    expect(authConfigured({ ...FULL, [name]: '  ' })).toBe(false);
  });
});

describe('needsAccountToken', () => {
  it.each([
    '/api/me',
    '/api/projects',
    '/api/organizations/inmobiliaria-los-aromos/members',
    '/api/integrations/projects/los-aromos',
    '/api/integrations/google/authorize',
    '/api/admin/users',
    '/api/admin/invitations',
  ])('%s lleva el token de la cuenta', (path) => {
    expect(needsAccountToken(path)).toBe(true);
  });

  it.each([
    '/api/health',
    '/api/members',
    '/api/meta',
    '/api/integrations/otra',
    '/api/administration',
    '/cuenta',
  ])('%s no', (path) => {
    expect(needsAccountToken(path)).toBe(false);
  });
});

it('el login vuelve a la página pedida', () => {
  expect(loginHref('/cuenta?x=1')).toBe(
    '/auth/login?returnTo=%2Fcuenta%3Fx%3D1',
  );
});
