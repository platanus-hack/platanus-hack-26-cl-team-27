import { type Api, hasDatabase, parallel, startApi } from './harness.ts';

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const timed = async <T>(work: () => Promise<T>) => {
  const started = performance.now();
  const value = await work();
  return { value, ms: performance.now() - started };
};

describe.skipIf(!hasDatabase)('espera larga de /events contra Postgres', () => {
  let api: Api;

  beforeAll(async () => {
    api = await startApi();
  });

  afterAll(async () => {
    await api.close();
  });

  beforeEach(async () => {
    await api.truncate();
  });

  const start = async () => {
    const first = await api.call('GET', '/events');
    return {
      cursor: first.body.cursor as number,
      epoch: first.body.epoch as number,
    };
  };

  it('anuncia el soporte y, sin wait, responde al tiro', async () => {
    const { cursor, epoch } = await start();
    const { value, ms } = await timed(() =>
      api.call('GET', `/events?after=${cursor}&epoch=${epoch}`),
    );
    expect(value.body.longPoll).toBe(true);
    expect(value.body.events).toEqual([]);
    expect(ms).toBeLessThan(1000);
  });

  it('una espera con wait=5 vuelve en menos de 1 s cuando otro cliente produce un evento', async () => {
    const { cursor, epoch } = await start();
    const waiting = timed(() =>
      api.call('GET', `/events?after=${cursor}&epoch=${epoch}&wait=5`),
    );
    await sleep(300);
    const claimed = await api.call('POST', '/seats/camila-vera/claim');
    expect(claimed.status).toBe(201);
    const { value, ms } = await waiting;
    expect(ms).toBeLessThan(1000);
    expect(value.status).toBe(200);
    expect(value.body.reset).toBe(false);
    expect(
      value.body.events.map((event: { kind: string }) => event.kind),
    ).toContain('seat.claimed');
    expect(value.body.cursor).toBeGreaterThan(cursor);
  });

  it('100 esperas simultáneas reciben el mismo evento', async () => {
    const { cursor, epoch } = await start();
    const waits = parallel(100, () =>
      api.call('GET', `/events?after=${cursor}&epoch=${epoch}&wait=8`),
    );
    await sleep(500);
    await api.call('POST', '/seats/camila-vera/claim');
    const replies = await waits;
    const seqs = new Set<number>();
    for (const reply of replies) {
      expect(reply.status).toBe(200);
      expect(reply.body.events).toHaveLength(1);
      expect(reply.body.events[0].kind).toBe('seat.claimed');
      seqs.add(reply.body.events[0].seq);
    }
    expect(seqs.size).toBe(1);
  });

  it('una espera sin eventos vuelve vacía al vencer', async () => {
    const { cursor, epoch } = await start();
    const { value, ms } = await timed(() =>
      api.call('GET', `/events?after=${cursor}&epoch=${epoch}&wait=1`),
    );
    expect(ms).toBeGreaterThanOrEqual(900);
    expect(ms).toBeLessThan(3000);
    expect(value.status).toBe(200);
    expect(value.body.events).toEqual([]);
    expect(value.body.reset).toBe(false);
    expect(value.body.cursor).toBe(cursor);
  });

  it('un reinicio durante la espera responde reset', async () => {
    const { cursor, epoch } = await start();
    const waiting = timed(() =>
      api.call('GET', `/events?after=${cursor}&epoch=${epoch}&wait=5`),
    );
    await sleep(300);
    await api.call('POST', '/room/reset', { presenter: true });
    const { value, ms } = await waiting;
    expect(ms).toBeLessThan(1500);
    expect(value.body.reset).toBe(true);
    expect(value.body.epoch).toBe(epoch + 1);
    expect(value.body.events).toEqual([]);
  });

  it('rechaza un wait fuera de rango', async () => {
    const reply = await api.call('GET', '/events?wait=11');
    expect(reply.status).toBe(400);
  });
});
