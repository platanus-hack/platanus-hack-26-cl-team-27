import {
  exchangeGmailCode,
  GMAIL_SEND_SCOPE,
  gmailAuthorizationUrl,
} from '../../src/infra/adapters/GmailAuthorization.ts';

const client = {
  clientId: 'id',
  clientSecret: 'secret',
  redirectUri: 'http://localhost:3999/gmail/callback',
};

describe('gmailAuthorizationUrl', () => {
  it('pide solo gmail.send, sin conexión y con consentimiento para recibir el refresh token', () => {
    const url = new URL(
      gmailAuthorizationUrl(client, 'estado', 'app@vigente.example'),
    );

    expect(url.origin + url.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'id',
      redirect_uri: 'http://localhost:3999/gmail/callback',
      response_type: 'code',
      scope: GMAIL_SEND_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state: 'estado',
      login_hint: 'app@vigente.example',
    });
  });
});

describe('exchangeGmailCode', () => {
  it('cambia el código por el refresh token', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ refresh_token: 'refresh', scope: GMAIL_SEND_SCOPE }),
      );

    await expect(exchangeGmailCode(client, 'code', fetcher)).resolves.toBe(
      'refresh',
    );
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).toContain(
      'grant_type=authorization_code',
    );
  });

  it('falla si no se concedió gmail.send', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ refresh_token: 'r', scope: 'openid' }),
      );

    await expect(exchangeGmailCode(client, 'code', fetcher)).rejects.toThrow(
      'gmail.send',
    );
  });
});
