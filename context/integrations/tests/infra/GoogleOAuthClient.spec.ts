import { ProviderError } from '../../src/application/errors.ts';
import {
  emailFromIdToken,
  GOOGLE_SCOPES,
  GoogleOAuthClient,
  SHEETS_READ_SCOPE,
} from '../../src/infra/adapters/GoogleOAuthClient.ts';

const CONFIG = {
  clientId: 'client-1',
  clientSecret: 'secret-1',
  redirectUri: 'http://localhost:3000/api/integrations/google/callback',
};

const idToken = (claims: object): string =>
  `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.firma`;

const json = (status: number, body: object): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const client = (responses: Response[], now: () => number = () => 0) => {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const response of responses) fetch.mockResolvedValueOnce(response);
  return { fetch, google: new GoogleOAuthClient(CONFIG, { fetch, now }) };
};

const formOf = (call: Parameters<typeof fetch>): URLSearchParams =>
  new URLSearchParams(String(call[1]?.body));

describe('GoogleOAuthClient', () => {
  it('pide acceso sin conexión, con consentimiento y solo lectura de planillas', () => {
    const url = new URL(client([]).google.authorizationUrl('state-1'));

    expect(url.origin + url.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client-1',
      redirect_uri: CONFIG.redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state: 'state-1',
    });
  });

  it('canjea el código por la cuenta, los permisos y el token permanente', async () => {
    const { fetch, google } = client([
      json(200, {
        access_token: 'access-1',
        expires_in: 3600,
        refresh_token: 'refresh-1',
        scope: `openid ${SHEETS_READ_SCOPE} email`,
        id_token: idToken({ email: 'daniela@example.com' }),
      }),
    ]);

    await expect(google.exchange('code-1')).resolves.toEqual({
      accountEmail: 'daniela@example.com',
      scopes: ['openid', SHEETS_READ_SCOPE, 'email'],
      refreshToken: 'refresh-1',
    });
    const call = fetch.mock.calls[0];
    expect(call?.[0]).toBe('https://oauth2.googleapis.com/token');
    expect(
      Object.fromEntries(formOf(call as Parameters<typeof fetch>)),
    ).toEqual({
      client_id: 'client-1',
      client_secret: 'secret-1',
      grant_type: 'authorization_code',
      code: 'code-1',
      redirect_uri: CONFIG.redirectUri,
    });
    await expect(google.accessToken('refresh-1')).resolves.toBe('access-1');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'sin token permanente',
      { access_token: 'a', scope: SHEETS_READ_SCOPE },
      /permiso permanente/,
    ],
    [
      'sin el permiso de planillas',
      {
        access_token: 'a',
        refresh_token: 'r',
        scope: 'openid email',
        id_token: idToken({ email: 'd@example.com' }),
      },
      /leer tus planillas/,
    ],
  ])('rechaza la conexión %s', async (_name, body, message) => {
    const { google } = client([json(200, body)]);
    await expect(google.exchange('code-1')).rejects.toThrow(message);
  });

  it('renueva el token de acceso solo cuando está por vencer', async () => {
    let now = 0;
    const { fetch, google } = client(
      [
        json(200, { access_token: 'access-1', expires_in: 3600 }),
        json(200, { access_token: 'access-2', expires_in: 3600 }),
      ],
      () => now,
    );

    expect(await google.accessToken('refresh-1')).toBe('access-1');
    now = 30 * 60_000;
    expect(await google.accessToken('refresh-1')).toBe('access-1');
    now = 3600_000 - 30_000;
    expect(await google.accessToken('refresh-1')).toBe('access-2');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      formOf(fetch.mock.calls[1] as Parameters<typeof fetch>).get('grant_type'),
    ).toBe('refresh_token');
  });

  it('traduce un permiso revocado', async () => {
    const { google } = client([json(400, { error: 'invalid_grant' })]);
    const failure = google.accessToken('refresh-1');
    await expect(failure).rejects.toBeInstanceOf(ProviderError);
    await expect(failure).rejects.toThrow(/vuelve a conectar/);
  });

  it('una caída de red es un error del proveedor', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(new TypeError('fetch failed'));
    const google = new GoogleOAuthClient(CONFIG, { fetch });
    await expect(google.accessToken('r')).rejects.toThrow(
      'No pudimos hablar con Google',
    );
  });
});

describe('emailFromIdToken', () => {
  it('lee el correo del token de identidad', () => {
    expect(emailFromIdToken(idToken({ email: 'a@b.cl' }))).toBe('a@b.cl');
    expect(emailFromIdToken(idToken({ sub: '1' }))).toBeNull();
    expect(emailFromIdToken('basura')).toBeNull();
    expect(emailFromIdToken(undefined)).toBeNull();
  });
});
