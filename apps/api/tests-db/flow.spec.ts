import {
  type Api,
  MINUTE,
  countBy,
  hasDatabase,
  parallel,
  startApi,
} from './harness.ts';

const PAULA = { presenter: true, actAs: 'paula-rojas' } as const;

const kinds = async (api: Api, kind: string): Promise<number> =>
  api.prisma.roomEvent.count({ where: { kind } });

const camila = async (api: Api): Promise<string> => {
  const claimed = await api.call('POST', '/seats/camila-vera/claim');
  expect(claimed.status).toBe(201);
  return claimed.body.token as string;
};

const trayY = (state: {
  elements: { id: string; box: { min: number[] } }[];
}): number | undefined =>
  state.elements.find((element) => element.id === 'E-B-03')?.box.min[1];

describe.skipIf(!hasDatabase)('flujo del caso P-12 contra Postgres', () => {
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

  it('GET /flow siembra el caso limpio: sin cambio, sin choque y la bandeja en y 6,45', async () => {
    const state = await api.call('GET', '/flow');
    expect(state.status).toBe(200);
    expect(state.body.change).toBeNull();
    expect(state.body.clash).toBeNull();
    expect(state.body.proposal).toBeNull();
    expect(trayY(state.body)).toBe(6.45);
  });

  it('con 10 minutas simultáneas del mismo minuteId la minuta es idempotente: misma propuesta y un solo evento', async () => {
    await api.call('GET', '/flow');
    const replies = await parallel(10, () =>
      api.call('POST', '/flow/minutes', {
        ...PAULA,
        body: MINUTE('minuta-1'),
      }),
    );
    expect(countBy(replies, (reply) => reply.status)).toEqual({ '201': 10 });
    const proposals = new Set(replies.map((reply) => reply.body.proposal.id));
    expect(proposals.size).toBe(1);
    expect(new Set(replies.map((reply) => reply.body.change.id)).size).toBe(1);
    expect(await kinds(api, 'flow.minute.received')).toBe(1);
    expect(await kinds(api, 'flow.clash.detected')).toBe(1);
    expect(await kinds(api, 'flow.fix.proposed')).toBe(1);
    expect(await api.prisma.proposal.count()).toBe(1);
  });

  it('con 10 minutas simultáneas de minuteId distintos entra una y las otras 9 reciben 409 change_open', async () => {
    await api.call('GET', '/flow');
    const replies = await parallel(10, (index) =>
      api.call('POST', '/flow/minutes', {
        ...PAULA,
        body: MINUTE(`minuta-${index}`),
      }),
    );
    expect(countBy(replies, (reply) => reply.status)).toEqual({
      '201': 1,
      '409': 9,
    });
    for (const loser of replies.filter((reply) => reply.status === 409)) {
      expect(loser.body.code).toBe('change_open');
    }
    expect(await kinds(api, 'flow.minute.received')).toBe(1);
    expect(await kinds(api, 'flow.fix.proposed')).toBe(1);
    expect(await api.prisma.proposal.count()).toBe(1);
    const winner = replies.find((reply) => reply.status === 201);
    const state = await api.call('GET', '/flow');
    expect(state.body.change.minuteId).toBe(winner?.body.change.minuteId);
  });

  it('con 10 aceptaciones simultáneas de Camila se aplica una y todas terminan en 200 con la propuesta resuelta', async () => {
    const token = await camila(api);
    const minute = await api.call('POST', '/flow/minutes', {
      ...PAULA,
      body: MINUTE('minuta-1'),
    });
    expect(minute.status).toBe(201);
    const id = minute.body.proposal.id as string;
    const replies = await parallel(10, () =>
      api.call('POST', `/flow/proposals/${id}/accept`, { token }),
    );
    expect(countBy(replies, (reply) => reply.status)).toEqual({ '200': 10 });
    for (const reply of replies) {
      expect(reply.body.proposal.id).toBe(id);
      expect(reply.body.proposal.status).toBe('resuelta');
      expect(reply.body.clash.status).toBe('resuelta');
    }
    expect(await kinds(api, 'flow.fix.accepted')).toBe(1);
    expect(await kinds(api, 'flow.fix.applied')).toBe(1);
    expect(await kinds(api, 'flow.resolved')).toBe(1);
    const final = await api.call('GET', '/flow');
    expect(final.body.proposal.status).toBe('resuelta');
    expect(trayY(final.body)).not.toBe(6.45);
  });

  it('solo Camila decide la propuesta: otra persona recibe 403 y sin credenciales 401', async () => {
    const minute = await api.call('POST', '/flow/minutes', {
      ...PAULA,
      body: MINUTE('minuta-1'),
    });
    const id = minute.body.proposal.id as string;
    const other = await api.call('POST', '/seats/javier-munoz/claim');
    const forbidden = await api.call('POST', `/flow/proposals/${id}/accept`, {
      token: other.body.token,
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('not_owner');
    const anonymous = await api.call('POST', `/flow/proposals/${id}/accept`);
    expect(anonymous.status).toBe(401);
    expect(await kinds(api, 'flow.fix.applied')).toBe(0);
  });

  it('aceptar y rechazar a la vez deja un solo desenlace y ninguna respuesta 500', async () => {
    const token = await camila(api);
    const minute = await api.call('POST', '/flow/minutes', {
      ...PAULA,
      body: MINUTE('minuta-1'),
    });
    const id = minute.body.proposal.id as string;
    const replies = await Promise.all([
      ...Array.from({ length: 5 }, () =>
        api.call('POST', `/flow/proposals/${id}/accept`, { token }),
      ),
      ...Array.from({ length: 5 }, () =>
        api.call('POST', `/flow/proposals/${id}/reject`, {
          token,
          body: { reason: 'No me calza con la canalización' },
        }),
      ),
    ]);
    expect(replies.some((reply) => reply.status >= 500)).toBe(false);
    const final = await api.call('GET', '/flow');
    const status = final.body.proposal.status as string;
    expect(['resuelta', 'rechazada']).toContain(status);
    const applied = await kinds(api, 'flow.fix.applied');
    const rejected = await kinds(api, 'flow.fix.rejected');
    expect(applied + rejected).toBe(1);
    expect(applied).toBe(status === 'resuelta' ? 1 : 0);
  });

  it('30 lecturas de /flow mientras Camila acepta no fallan y cada una es el estado de antes o el de después', async () => {
    const token = await camila(api);
    const minute = await api.call('POST', '/flow/minutes', {
      ...PAULA,
      body: MINUTE('minuta-1'),
    });
    const id = minute.body.proposal.id as string;
    const before = (await api.call('GET', '/flow')).body;
    expect(before.proposal.status).toBe('propuesta');
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));
    const [accept, ...reads] = await Promise.all([
      api.call('POST', `/flow/proposals/${id}/accept`, { token }),
      ...Array.from({ length: 30 }, async (_, index) => {
        await sleep(index * 4);
        return api.call('GET', '/flow');
      }),
    ]);
    expect(accept.status).toBe(200);
    const after = (await api.call('GET', '/flow')).body;
    expect(after.proposal.status).toBe('resuelta');
    expect(reads.every((read) => read.status === 200)).toBe(true);
    for (const read of reads) {
      const isBefore = JSON.stringify(read.body) === JSON.stringify(before);
      const isAfter = JSON.stringify(read.body) === JSON.stringify(after);
      expect(isBefore || isAfter).toBe(true);
    }
  });

  it('POST /flow/reset deja el caso limpio y la bandeja vuelve a y 6,45', async () => {
    const token = await camila(api);
    const minute = await api.call('POST', '/flow/minutes', {
      ...PAULA,
      body: MINUTE('minuta-1'),
    });
    await api.call(
      'POST',
      `/flow/proposals/${minute.body.proposal.id as string}/accept`,
      { token },
    );
    const moved = await api.call('GET', '/flow');
    expect(trayY(moved.body)).not.toBe(6.45);
    const denied = await api.call('POST', '/flow/reset');
    expect(denied.status).toBe(401);
    const reset = await api.call('POST', '/flow/reset', { presenter: true });
    expect(reset.status).toBe(200);
    expect(reset.body.change).toBeNull();
    expect(reset.body.proposal).toBeNull();
    expect(trayY(reset.body)).toBe(6.45);
    const again = await api.call('POST', '/flow/minutes', {
      ...PAULA,
      body: MINUTE('minuta-2'),
    });
    expect(again.status).toBe(201);
    expect(again.body.proposal.status).toBe('propuesta');
    expect(await kinds(api, 'flow.reset')).toBe(1);
  });

  it('un reinicio del caso con lecturas, sondeos y decisiones en curso no produce 500', async () => {
    const token = await camila(api);
    const minute = await api.call('POST', '/flow/minutes', {
      ...PAULA,
      body: MINUTE('minuta-1'),
    });
    const id = minute.body.proposal.id as string;
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));
    const replies = await Promise.all([
      api.call('POST', '/flow/reset', { presenter: true }),
      ...Array.from({ length: 20 }, async (_, index) => {
        await sleep(index * 5);
        return api.call('GET', '/flow');
      }),
      ...Array.from({ length: 20 }, async (_, index) => {
        await sleep(index * 5);
        return api.call('GET', '/events?after=0&epoch=1', { token });
      }),
      api.call('POST', `/flow/proposals/${id}/accept`, { token }),
    ]);
    expect(replies.filter((reply) => reply.status >= 500)).toEqual([]);
    const final = await api.call('GET', '/flow');
    expect(final.status).toBe(200);
  });
});
