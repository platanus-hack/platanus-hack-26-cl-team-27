import { Auth0Client } from '@auth0/nextjs-auth0/server';

import { authConfigured, AUTH0_SCOPE } from './account-routes';

export const authEnabled = authConfigured(process.env);

export const auth0 = authEnabled
  ? new Auth0Client({
      authorizationParameters: {
        audience: process.env['AUTH0_AUDIENCE'],
        scope: AUTH0_SCOPE,
      },
    })
  : null;
