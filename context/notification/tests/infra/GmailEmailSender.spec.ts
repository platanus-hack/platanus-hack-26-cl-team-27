import {
  buildRawMessage,
  GmailEmailSender,
} from '../../src/infra/adapters/GmailEmailSender.ts';

const email = {
  to: 'paula@obra.example',
  subject: 'Losa nivel 3 · Espesor: 15 cm → 20 cm',
  text: 'Sube el costo',
  html: '<p>Sube el costo</p>',
  idempotencyKey: 'd1',
};

const credentials = {
  clientId: 'id',
  clientSecret: 'secret',
  refreshToken: 'refresh',
};

const decode = (raw: string): string =>
  Buffer.from(raw, 'base64url').toString('utf8');

const tokenResponse = () =>
  Response.json({ access_token: 'access-1', expires_in: 3600 });

describe('buildRawMessage', () => {
  it('arma un MIME con asunto UTF-8, texto y HTML', () => {
    const message = decode(
      buildRawMessage('Vigente <app@vigente.example>', email),
    );

    expect(message).toContain('From: Vigente <app@vigente.example>');
    expect(message).toContain('To: paula@obra.example');
    expect(message).toContain(
      `Subject: =?UTF-8?B?${Buffer.from(email.subject).toString('base64')}?=`,
    );
    expect(message).toContain('X-Vigente-Delivery: d1');
    expect(message).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(message).toContain('Content-Type: text/html; charset=UTF-8');
    expect(message).toContain(
      Buffer.from('<p>Sube el costo</p>').toString('base64'),
    );
  });

  it('no deja inyectar cabeceras con saltos de línea', () => {
    const message = decode(
      buildRawMessage('a@b.example', {
        ...email,
        to: 'x@y.example\r\nBcc: otro@z.example',
      }),
    );

    expect(message).not.toMatch(/^Bcc:/m);
  });
});

describe('GmailEmailSender', () => {
  it('renueva el acceso con el refresh token y lo reusa mientras dura', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(Response.json({ id: 'gmail-1' }))
      .mockResolvedValueOnce(Response.json({ id: 'gmail-2' }));
    const sender = new GmailEmailSender(credentials, 'a@b.example', fetcher);

    await expect(sender.send(email)).resolves.toBe('gmail-1');
    await expect(sender.send(email)).resolves.toBe('gmail-2');

    expect(fetcher).toHaveBeenCalledTimes(3);
    const [tokenUrl, tokenInit] = fetcher.mock.calls[0] ?? [];
    expect(tokenUrl).toBe('https://oauth2.googleapis.com/token');
    expect(String(tokenInit?.body)).toContain('grant_type=refresh_token');
    expect(String(tokenInit?.body)).toContain('refresh_token=refresh');
    const [sendUrl, sendInit] = fetcher.mock.calls[1] ?? [];
    expect(sendUrl).toBe(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    );
    expect(sendInit?.headers).toMatchObject({
      authorization: 'Bearer access-1',
    });
  });

  it('pide un acceso nuevo cuando el anterior está por vencer', async () => {
    let now = 0;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(Response.json({ id: 'gmail-1' }))
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(Response.json({ id: 'gmail-2' }));
    const sender = new GmailEmailSender(
      credentials,
      'a@b.example',
      fetcher,
      () => now,
    );

    await sender.send(email);
    now = 3_550_000;
    await sender.send(email);

    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('si Google no renueva, pide volver a autorizar', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          {
            error: 'invalid_grant',
            error_description: 'Token has been expired or revoked.',
          },
          { status: 400 },
        ),
      );

    await expect(
      new GmailEmailSender(credentials, 'a@b.example', fetcher).send(email),
    ).rejects.toThrow(/Token has been expired or revoked.*pnpm gmail:auth/);
  });

  it('si Gmail rechaza el envío, falla con su mensaje y olvida un acceso inválido', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        Response.json(
          { error: { message: 'Invalid Credentials' } },
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(Response.json({ id: 'gmail-2' }));
    const sender = new GmailEmailSender(credentials, 'a@b.example', fetcher);

    await expect(sender.send(email)).rejects.toThrow(
      'Gmail respondió 401: Invalid Credentials',
    );
    await expect(sender.send(email)).resolves.toBe('gmail-2');
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
