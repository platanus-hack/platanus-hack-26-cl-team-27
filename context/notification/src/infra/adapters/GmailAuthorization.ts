export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

export interface GmailClient {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export const gmailAuthorizationUrl = (
  client: Pick<GmailClient, 'clientId' | 'redirectUri'>,
  state: string,
  loginHint?: string,
): string => {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    response_type: 'code',
    scope: GMAIL_SEND_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
    ...(loginHint ? { login_hint: loginHint } : {}),
  }).toString();
  return url.toString();
};

export const exchangeGmailCode = async (
  client: GmailClient,
  code: string,
  fetcher: typeof fetch = fetch,
): Promise<string> => {
  const response = await fetcher(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: client.redirectUri,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => ({}))) as {
    refresh_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok) {
    throw new Error(
      `Google rechazó el código (${response.status}: ${body.error_description ?? body.error ?? 'sin detalle'})`,
    );
  }
  if (!body.scope?.split(' ').includes(GMAIL_SEND_SCOPE)) {
    throw new Error('Falta el permiso para mandar correos (gmail.send)');
  }
  if (!body.refresh_token) {
    throw new Error('Google no entregó un refresh token');
  }
  return body.refresh_token;
};
