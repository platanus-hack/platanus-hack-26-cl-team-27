import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';

import {
  exchangeGmailCode,
  gmailAuthorizationUrl,
} from '@team27/context-notification/adapters';

const ENV_FILE = '.env';
const DEFAULT_REDIRECT_URI = 'http://localhost:3999/gmail/callback';

const clientId = process.env['GMAIL_CLIENT_ID']?.trim();
const clientSecret = process.env['GMAIL_CLIENT_SECRET']?.trim();
const redirectUri =
  process.env['GMAIL_REDIRECT_URI']?.trim() || DEFAULT_REDIRECT_URI;
const sender = /<([^>]+)>/.exec(process.env['EMAIL_FROM'] ?? '')?.[1];

if (!clientId || !clientSecret) {
  console.error('Faltan GMAIL_CLIENT_ID y GMAIL_CLIENT_SECRET en el .env');
  process.exit(1);
}

const saveRefreshToken = (token: string): void => {
  const line = `GMAIL_REFRESH_TOKEN=${token}`;
  const current = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
  const next = /^GMAIL_REFRESH_TOKEN=.*$/m.test(current)
    ? current.replace(/^GMAIL_REFRESH_TOKEN=.*$/m, line)
    : `${current.replace(/\s*$/, '')}\n${line}\n`;
  writeFileSync(ENV_FILE, next);
};

const client = { clientId, clientSecret, redirectUri };
const callback = new URL(redirectUri);
const state = randomBytes(16).toString('hex');

const hosts =
  callback.hostname === 'localhost'
    ? ['127.0.0.1', '::1']
    : [callback.hostname];
const servers = hosts.map(() => createServer(handle));
const closeAll = () => {
  for (const server of servers) server.close();
};

function handle(request: IncomingMessage, response: ServerResponse): void {
  const url = new URL(request.url ?? '/', redirectUri);
  if (url.pathname !== callback.pathname) {
    response.writeHead(404).end();
    return;
  }
  const finish = (status: number, message: string) => {
    response
      .writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
      .end(message);
    console.log(message);
    closeAll();
  };
  if (url.searchParams.get('state') !== state) {
    response
      .writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
      .end('La autorización no partió aquí: usa el enlace del comando');
    return;
  }
  const code = url.searchParams.get('code');
  if (!code) {
    finish(
      400,
      `Google no autorizó: ${url.searchParams.get('error') ?? 'sin código'}`,
    );
    return;
  }
  exchangeGmailCode(client, code).then(
    (token) => {
      saveRefreshToken(token);
      finish(
        200,
        'Listo: guardé GMAIL_REFRESH_TOKEN en el .env. Ya puedes cerrar esta pestaña.',
      );
    },
    (error: unknown) =>
      finish(500, error instanceof Error ? error.message : String(error)),
  );
}

Promise.all(
  servers.map(
    (server, index) =>
      new Promise<void>((resolve) =>
        server.listen(Number(callback.port || 80), hosts[index], resolve),
      ),
  ),
).then(() => {
  console.log(
    `Abre este enlace${sender ? ` con la cuenta ${sender}` : ''} y autoriza a Vigente a mandar correos:\n\n${gmailAuthorizationUrl(client, state, sender)}\n`,
  );
});
