import { type Api, hasDatabase, parallel, startApi } from './harness.ts';

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

describe.skipIf(!hasDatabase)('reinicio de la sala contra Postgres', () => {
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

  it('POST /room/reset sube la época en 1, suelta los asientos y los sondeos con la época vieja reciben reset true', async () => {
    const claimed = await api.call('POST', '/seats/camila-vera/claim');
    const token = claimed.body.token as string;
    const before = await api.call('GET', '/events', { token });
    expect(before.body.seat).toBe('camila-vera');
    const epoch = before.body.epoch as number;
    const denied = await api.call('POST', '/room/reset');
    expect(denied.status).toBe(401);

    const reset = await api.call('POST', '/room/reset', { presenter: true });
    expect(reset.status).toBe(200);
    expect(reset.body.epoch).toBe(epoch + 1);
    expect(await api.prisma.seat.count()).toBe(0);

    const poll = await api.call(
      'GET',
      `/events?after=${before.body.cursor as number}&epoch=${epoch}`,
      { token },
    );
    expect(poll.status).toBe(200);
    expect(poll.body.reset).toBe(true);
    expect(poll.body.epoch).toBe(epoch + 1);
    expect(poll.body.seat).toBeNull();
    const fresh = await api.call('GET', `/events?after=0&epoch=${epoch + 1}`);
    expect(fresh.body.reset).toBe(false);
    expect(
      fresh.body.events.map((event: { kind: string }) => event.kind),
    ).toContain('room.reset');
  });

  it('dos reinicios simultáneos suben la época en 2 y ninguno falla', async () => {
    const before = await api.call('GET', '/events');
    const replies = await parallel(2, () =>
      api.call('POST', '/room/reset', { presenter: true }),
    );
    expect(replies.map((reply) => reply.status)).toEqual([200, 200]);
    const after = await api.call('GET', '/events');
    expect(after.body.epoch).toBe(before.body.epoch + 2);
  });

  it('un reinicio con lecturas, sondeos anónimos y tomas de asiento en curso no produce 500', async () => {
    await api.call('GET', '/flow');
    const replies = await Promise.all([
      api.call('POST', '/room/reset', { presenter: true }),
      ...Array.from({ length: 20 }, async (_, index) => {
        await sleep(index * 5);
        return api.call('GET', '/flow');
      }),
      ...Array.from({ length: 20 }, async (_, index) => {
        await sleep(index * 5);
        return api.call('GET', '/events?after=0&epoch=1');
      }),
      ...Array.from({ length: 10 }, async (_, index) => {
        await sleep(index * 8);
        return api.call('GET', '/room');
      }),
      ...['javier-munoz', 'tomas-reyes'].map(async (castId, index) => {
        await sleep(index * 10);
        return api.call('POST', `/seats/${castId}/claim`);
      }),
    ]);
    expect(replies.filter((reply) => reply.status >= 500)).toEqual([]);
  });

  it(
    'un reinicio con sondeos con token en curso no produce 500',
    async () => {
      const failures: number[] = [];
      for (let round = 0; round < 5; round += 1) {
        const claimed = await api.call('POST', '/seats/camila-vera/claim');
        const token = claimed.body.token as string;
        const replies = await Promise.all([
          api.call('POST', '/room/reset', { presenter: true }),
          ...Array.from({ length: 40 }, async (_, index) => {
            await sleep(index * 3);
            return api.call('GET', '/events', { token });
          }),
        ]);
        failures.push(
          ...replies
            .filter((reply) => reply.status >= 500)
            .map((reply) => reply.status),
        );
      }
      expect(failures).toEqual([]);
    },
  );
});
