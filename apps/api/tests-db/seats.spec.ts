import {
  type Api,
  countBy,
  hasDatabase,
  parallel,
  startApi,
} from './harness.ts';

const SEATS = [
  'paula-rojas',
  'marcos-fuentes',
  'daniela-soto',
  'javier-munoz',
  'camila-vera',
  'tomas-reyes',
];

describe.skipIf(!hasDatabase)('asientos contra Postgres', () => {
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

  it('con 30 tomas simultáneas del mismo asiento gana una y las otras 29 reciben 409 seat_taken', async () => {
    const replies = await parallel(30, () =>
      api.call('POST', '/seats/camila-vera/claim'),
    );
    expect(countBy(replies, (reply) => reply.status)).toEqual({
      '201': 1,
      '409': 29,
    });
    for (const loser of replies.filter((reply) => reply.status === 409)) {
      expect(loser.body.code).toBe('seat_taken');
    }
    const winner = replies.find((reply) => reply.status === 201);
    expect(winner?.body.castId).toBe('camila-vera');
    expect(typeof winner?.body.token).toBe('string');
    expect(await api.prisma.seat.count()).toBe(1);
    const events = await api.prisma.roomEvent.findMany({
      where: { kind: 'seat.claimed' },
    });
    expect(events).toHaveLength(1);
  });

  it('con 6 asientos distintos tomados en paralelo ganan todos', async () => {
    const replies = await Promise.all(
      SEATS.map((castId) => api.call('POST', `/seats/${castId}/claim`)),
    );
    expect(replies.map((reply) => reply.status)).toEqual(SEATS.map(() => 201));
    expect(new Set(replies.map((reply) => reply.body.token)).size).toBe(6);
    expect(await api.prisma.seat.count()).toBe(6);
  });

  it.fails(
    'con la base recién creada (sin room_state), 6 asientos tomados en paralelo ganan todos [BUG: readState hace upsert y la carrera de creación devuelve 500]',
    async () => {
      await api.truncate({ warm: false });
      const replies = await Promise.all(
        SEATS.map((castId) => api.call('POST', `/seats/${castId}/claim`)),
      );
      expect(replies.map((reply) => reply.status)).toEqual(
        SEATS.map(() => 201),
      );
    },
  );

  it('el asiento de la presentadora no se toma desde un celular', async () => {
    const reply = await api.call('POST', '/seats/fernanda-lagos/claim');
    expect(reply.status).toBe(403);
    expect(reply.body.code).toBe('presenter_seat');
  });

  it('un asiento sin latido por más de PRESENCE_MS se toma con un token nuevo y el viejo pasa a 401', async () => {
    const first = await api.call('POST', '/seats/camila-vera/claim');
    expect(first.status).toBe(201);
    const old = first.body.token as string;
    const beforeExpiry = await api.call('GET', '/events', { token: old });
    expect(beforeExpiry.body.seat).toBe('camila-vera');
    const again = await api.call('POST', '/seats/camila-vera/claim');
    expect(again.status).toBe(409);

    await api.prisma
      .$executeRaw`UPDATE seats SET last_beat_at = now() - interval '25 seconds' WHERE cast_id = 'camila-vera'`;

    const second = await api.call('POST', '/seats/camila-vera/claim');
    expect(second.status).toBe(201);
    expect(second.body.token).not.toBe(old);

    const stale = await api.call('POST', '/flow/presence', {
      token: old,
      body: { viewing: null },
    });
    expect(stale.status).toBe(401);
    expect(stale.body.code).toBe('seat_required');
    const fresh = await api.call('POST', '/flow/presence', {
      token: second.body.token,
      body: { viewing: null },
    });
    expect(fresh.status).toBe(200);
    expect(await api.prisma.seat.count()).toBe(1);
  });

  it('con 30 tomas simultáneas de un asiento vencido gana una sola', async () => {
    const first = await api.call('POST', '/seats/javier-munoz/claim');
    expect(first.status).toBe(201);
    await api.prisma
      .$executeRaw`UPDATE seats SET last_beat_at = now() - interval '25 seconds' WHERE cast_id = 'javier-munoz'`;
    const replies = await parallel(30, () =>
      api.call('POST', '/seats/javier-munoz/claim'),
    );
    expect(countBy(replies, (reply) => reply.status)).toEqual({
      '201': 1,
      '409': 29,
    });
  });

  it('DELETE /seats/:castId suelta el asiento y lo deja libre para otra persona', async () => {
    const claimed = await api.call('POST', '/seats/tomas-reyes/claim');
    const token = claimed.body.token as string;
    const released = await api.call('DELETE', '/seats/tomas-reyes', { token });
    expect(released.status).toBe(204);
    expect(await api.prisma.seat.count()).toBe(0);
    const events = await api.prisma.roomEvent.findMany({
      where: { kind: 'seat.released' },
    });
    expect(events).toHaveLength(1);
    const taken = await api.call('POST', '/seats/tomas-reyes/claim');
    expect(taken.status).toBe(201);
  });

  it('soltar el asiento de otra persona responde 403 y un token ajeno no sirve', async () => {
    const mine = await api.call('POST', '/seats/tomas-reyes/claim');
    const other = await api.call('POST', '/seats/daniela-soto/claim');
    const forbidden = await api.call('DELETE', '/seats/tomas-reyes', {
      token: other.body.token,
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('not_your_seat');
    const anonymous = await api.call('DELETE', '/seats/tomas-reyes');
    expect(anonymous.status).toBe(401);
    expect(await api.prisma.seat.count()).toBe(2);
    expect(mine.status).toBe(201);
  });

  it('30 sondeos de /events con token no fallan y mantienen vivo el asiento', async () => {
    const claimed = await api.call('POST', '/seats/camila-vera/claim');
    const token = claimed.body.token as string;
    const replies = await parallel(30, () =>
      api.call('GET', '/events', { token }),
    );
    expect(replies.every((reply) => reply.status === 200)).toBe(true);
    expect(replies.every((reply) => reply.body.seat === 'camila-vera')).toBe(
      true,
    );
  });
});
