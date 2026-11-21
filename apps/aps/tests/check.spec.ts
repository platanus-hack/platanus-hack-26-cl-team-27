import { check, type CheckClients } from '../src/check.ts';
import type { Output } from '../src/io.ts';

const config = { clientId: 'id', clientSecret: 'secret', bucketKey: 'b' };

const capture = (): Output & { lines: string[] } => {
  const lines: string[] = [];
  return {
    lines,
    out: (line) => lines.push(line),
    err: (line) => lines.push(line),
  };
};

const httpError = (status: number): Error =>
  Object.assign(new Error(`HTTP ${status}`), {
    axiosError: { response: { status } },
  });

const clients = (outcome: { auth?: Error; bucket?: Error }): CheckClients => ({
  auth: {
    getTwoLeggedToken: vi.fn(async () => {
      if (outcome.auth) throw outcome.auth;
      return { access_token: 'tok', expires_in: 3599 };
    }),
  } as unknown as CheckClients['auth'],
  oss: {
    getBucketDetails: vi.fn(async () => {
      if (outcome.bucket) throw outcome.bucket;
      return {};
    }),
  } as unknown as CheckClients['oss'],
});

describe('check', () => {
  it('confirma las credenciales y que la app ve el bucket', async () => {
    const io = capture();
    expect(await check(config, io, clients({}))).toBe(0);
    expect(io.lines).toEqual([
      'APS: credenciales válidas (HTTP 200, el token dura 3599 s).',
      'Bucket b: lo ve esta app.',
    ]);
  });

  it('falla sin mostrar las credenciales si APS las rechaza', async () => {
    const io = capture();
    expect(await check(config, io, clients({ auth: httpError(401) }))).toBe(1);
    expect(io.lines).toEqual(['APS: credenciales rechazadas (HTTP 401).']);
    expect(io.lines.join(' ')).not.toContain('secret');
  });

  it('distingue un bucket que no existe de uno de otra app', async () => {
    const missing = capture();
    expect(
      await check(config, missing, clients({ bucket: httpError(404) })),
    ).toBe(1);
    expect(missing.lines.at(-1)).toBe(
      'Bucket b: no existe; pnpm aps:models lo crea.',
    );
    const foreign = capture();
    expect(
      await check(config, foreign, clients({ bucket: httpError(403) })),
    ).toBe(1);
    expect(foreign.lines.at(-1)).toContain('es de otra app de APS');
  });
});
