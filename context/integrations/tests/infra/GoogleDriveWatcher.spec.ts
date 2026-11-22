import { ProviderError } from '../../src/application/errors.ts';
import { GoogleDriveWatcher } from '../../src/infra/adapters/GoogleDriveWatcher.ts';

const NOW = Date.parse('2026-11-21T21:00:00Z');
const DAY = 86_400_000;
const FILE = '1plICs-go_g91zGKQ6p35r67ztd2zfCbBLrJvSucVRYo';
const ADDRESS = 'https://vigente.example/api/integrations/google/notifications';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const build = (response: Response | (() => Promise<Response>)) => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    typeof response === 'function' ? response() : response,
  );
  const watcher = new GoogleDriveWatcher({
    fetch,
    now: () => NOW,
    channelId: () => 'ch-1',
    secret: () => 'secret-1',
  });
  return { fetch, watcher };
};

describe('GoogleDriveWatcher', () => {
  it('se suscribe a los cambios del archivo con files.watch', async () => {
    const { fetch, watcher } = build(
      json(200, {
        kind: 'api#channel',
        id: 'ch-1',
        resourceId: 'res-1',
        expiration: String(NOW + DAY),
      }),
    );

    const channel = await watcher.watch('access-1', FILE, {
      address: ADDRESS,
      ttlMs: DAY,
    });

    expect(channel).toEqual({
      id: 'ch-1',
      resourceId: 'res-1',
      token: 'secret-1',
      expiresAt: new Date(NOW + DAY),
    });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(
      `https://www.googleapis.com/drive/v3/files/${FILE}/watch?supportsAllDrives=true`,
    );
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer access-1',
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      id: 'ch-1',
      type: 'web_hook',
      address: ADDRESS,
      token: 'secret-1',
      expiration: String(NOW + DAY),
    });
  });

  it('usa el vencimiento que da Google aunque sea más corto', async () => {
    const { watcher } = build(
      json(200, {
        id: 'ch-1',
        resourceId: 'res-1',
        expiration: String(NOW + 3_600_000),
      }),
    );

    const channel = await watcher.watch('access-1', FILE, {
      address: ADDRESS,
      ttlMs: DAY,
    });

    expect(channel.expiresAt).toEqual(new Date(NOW + 3_600_000));
  });

  it('explica cuando Google no acepta la URL de avisos', async () => {
    const { watcher } = build(
      json(400, {
        error: {
          message: 'WebHook callback must be HTTPS: http://localhost/x',
          errors: [{ reason: 'push.webhookUrlNotHttps' }],
        },
      }),
    );

    await expect(
      watcher.watch('access-1', FILE, { address: ADDRESS, ttlMs: DAY }),
    ).rejects.toThrow(/URL de avisos/);
  });

  it('un permiso vencido pide volver a conectar aunque el mensaje traiga un link', async () => {
    const { watcher } = build(
      json(401, {
        error: {
          message:
            'Request had invalid authentication credentials. See https://developers.google.com/identity/',
          errors: [{ reason: 'authError' }],
        },
      }),
    );

    await expect(
      watcher.watch('access-1', FILE, { address: ADDRESS, ttlMs: DAY }),
    ).rejects.toThrow(/vuelve a conectar la cuenta/);
  });

  it('explica cuando la API de Drive no está activada', async () => {
    const { watcher } = build(
      json(403, {
        error: {
          message:
            'Google Drive API has not been used in project 1 before or it is disabled',
          errors: [{ reason: 'accessNotConfigured' }],
        },
      }),
    );

    await expect(
      watcher.watch('access-1', FILE, { address: ADDRESS, ttlMs: DAY }),
    ).rejects.toThrow(/API de Google Drive no está activada/);
  });

  it('cierra un canal con channels.stop', async () => {
    const { fetch, watcher } = build(new Response(null, { status: 204 }));

    await watcher.stop('access-1', {
      id: 'ch-1',
      resourceId: 'res-1',
      token: 'secret-1',
      expiresAt: new Date(NOW),
    });

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://www.googleapis.com/drive/v3/channels/stop');
    expect(JSON.parse(String(init?.body))).toEqual({
      id: 'ch-1',
      resourceId: 'res-1',
    });
  });

  it('cerrar un canal que ya no existe no es un error', async () => {
    const { watcher } = build(json(404, { error: { message: 'not found' } }));

    await expect(
      watcher.stop('access-1', {
        id: 'ch-1',
        resourceId: 'res-1',
        token: 'secret-1',
        expiresAt: new Date(NOW),
      }),
    ).resolves.toBeUndefined();
  });

  it('dice quién editó el archivo por última vez', async () => {
    const { fetch, watcher } = build(
      json(200, {
        lastModifyingUser: {
          displayName: 'Daniela Soto',
          emailAddress: 'daniela@example.com',
        },
      }),
    );

    expect(await watcher.lastEditor('access-1', FILE)).toEqual({
      name: 'Daniela Soto',
      email: 'daniela@example.com',
    });
    expect(String(fetch.mock.calls[0]?.[0])).toContain(
      `/files/${FILE}?fields=lastModifyingUser`,
    );
  });

  it('sin datos de quién editó devuelve null', async () => {
    const { watcher } = build(json(200, {}));

    expect(await watcher.lastEditor('access-1', FILE)).toBeNull();
  });

  it('sin red falla con un error de Google', async () => {
    const { watcher } = build(() => Promise.reject(new TypeError('offline')));

    await expect(watcher.lastEditor('access-1', FILE)).rejects.toBeInstanceOf(
      ProviderError,
    );
  });
});
