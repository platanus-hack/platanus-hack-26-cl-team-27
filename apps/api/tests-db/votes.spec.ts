import {
  type Api,
  countBy,
  hasDatabase,
  loadLago,
  parallel,
  startApi,
} from './harness.ts';

const lago = loadLago();

const asSeat = (castId: string, actionId?: string) => ({
  presenter: true,
  actAs: castId,
  ...(actionId ? { actionId } : {}),
});

const armOverlap = async (api: Api) => {
  await api.call('GET', '/flow');
  const seeded = await api.call('POST', '/lake/seed', {
    presenter: true,
    body: { revisions: lago.seed },
  });
  expect(seeded.status).toBe(201);
  for (const step of [lago.a201C, lago.a201D]) {
    const ingested = await api.call('POST', '/revisions', {
      ...asSeat(step.authorId),
      body: step.body,
    });
    expect(ingested.status).toBe(201);
  }
  const overlaps = await api.call('GET', '/overlaps');
  const open = overlaps.body.overlaps.filter(
    (item: { status: string }) => item.status === 'abierto',
  );
  expect(open).toHaveLength(1);
  return open[0] as {
    id: string;
    proposalId: string;
    validators: string[];
  };
};

const voted = (api: Api) =>
  api.prisma.roomEvent.count({ where: { kind: 'overlap.voted' } });

describe.skipIf(!hasDatabase)('votos de la sala contra Postgres', () => {
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

  it('el lago de la muestra abre un solapamiento que validan Javier y Fernanda', async () => {
    const overlap = await armOverlap(api);
    expect([...overlap.validators].sort()).toEqual([
      'fernanda-lagos',
      'javier-munoz',
    ]);
    expect(await api.prisma.overlapVote.count()).toBe(0);
  });

  it('con 8 votos simultáneos del mismo asiento queda un solo voto y un solo evento', async () => {
    const overlap = await armOverlap(api);
    const replies = await parallel(8, (index) =>
      api.call('POST', `/overlaps/${overlap.id}/vote`, {
        ...asSeat('javier-munoz', `voto-${index}`),
        body: { kind: 'se_tocan', note: 'Cruza el colector' },
      }),
    );
    expect(countBy(replies, (reply) => reply.status)).toEqual({ '200': 8 });
    expect(await api.prisma.overlapVote.count()).toBe(1);
    expect(await voted(api)).toBe(1);
    const state = await api.call('GET', '/overlaps');
    const item = state.body.overlaps.find(
      (candidate: { id: string }) => candidate.id === overlap.id,
    );
    expect(item.votes).toHaveLength(1);
    expect(item.status).toBe('confirmado');
    expect(
      await api.prisma.roomEvent.count({
        where: { kind: 'overlap.confirmed' },
      }),
    ).toBe(1);
  });

  it('el mismo x-action-id repetido en paralelo comparte una sola ejecución y la misma respuesta', async () => {
    const overlap = await armOverlap(api);
    const replies = await parallel(8, () =>
      api.call('POST', `/overlaps/${overlap.id}/vote`, {
        ...asSeat('javier-munoz', 'accion-unica'),
        body: { kind: 'se_tocan', note: null },
      }),
    );
    expect(countBy(replies, (reply) => reply.status)).toEqual({ '200': 8 });
    expect(
      new Set(replies.map((reply) => JSON.stringify(reply.body))).size,
    ).toBe(1);
    expect(await api.prisma.overlapVote.count()).toBe(1);
    expect(await voted(api)).toBe(1);
    const again = await api.call('POST', `/overlaps/${overlap.id}/vote`, {
      ...asSeat('javier-munoz', 'accion-unica'),
      body: { kind: 'se_tocan', note: null },
    });
    expect(again.status).toBe(200);
    expect(await voted(api)).toBe(1);
  });

  it('con 2 asientos que votan a la vez se_tocan el solapamiento queda confirmado con 2 votos', async () => {
    const overlap = await armOverlap(api);
    const replies = await Promise.all(
      ['javier-munoz', 'fernanda-lagos'].flatMap((castId) =>
        Array.from({ length: 4 }, (_, index) =>
          api.call('POST', `/overlaps/${overlap.id}/vote`, {
            ...asSeat(castId, `${castId}-${index}`),
            body: { kind: 'se_tocan' },
          }),
        ),
      ),
    );
    expect(countBy(replies, (reply) => reply.status)).toEqual({ '200': 8 });
    expect(await api.prisma.overlapVote.count()).toBe(2);
    expect(await voted(api)).toBe(2);
    const state = await api.call('GET', '/overlaps');
    const item = state.body.overlaps.find(
      (candidate: { id: string }) => candidate.id === overlap.id,
    );
    expect(item.votes).toHaveLength(2);
    expect(item.status).toBe('confirmado');
    expect(
      await api.prisma.roomEvent.count({
        where: { kind: 'overlap.confirmed' },
      }),
    ).toBe(1);
  });

  it('con 2 asientos que votan a la vez no_se_tocan el solapamiento queda descartado una sola vez', async () => {
    const overlap = await armOverlap(api);
    const replies = await Promise.all(
      ['javier-munoz', 'fernanda-lagos'].flatMap((castId) =>
        Array.from({ length: 4 }, () =>
          api.call('POST', `/overlaps/${overlap.id}/vote`, {
            ...asSeat(castId),
            body: { kind: 'no_se_tocan' },
          }),
        ),
      ),
    );
    expect(countBy(replies, (reply) => reply.status)).toEqual({ '200': 8 });
    expect(await api.prisma.overlapVote.count()).toBe(2);
    const state = await api.call('GET', '/overlaps');
    const item = state.body.overlaps.find(
      (candidate: { id: string }) => candidate.id === overlap.id,
    );
    expect(item.status).toBe('descartado');
    expect(
      await api.prisma.roomEvent.count({ where: { kind: 'overlap.cleared' } }),
    ).toBe(1);
  });

  it('quien no valida el solapamiento recibe 403 y su voto no se guarda', async () => {
    const overlap = await armOverlap(api);
    const reply = await api.call('POST', `/overlaps/${overlap.id}/vote`, {
      ...asSeat('marcos-fuentes'),
      body: { kind: 'se_tocan' },
    });
    expect(reply.status).toBe(403);
    expect(reply.body.code).toBe('not_validator');
    expect(await api.prisma.overlapVote.count()).toBe(0);
  });

  it('con un voto por token de asiento y el mismo por la presentadora, el asiento tomado manda y no hay duplicados', async () => {
    const overlap = await armOverlap(api);
    const seat = await api.call('POST', '/seats/javier-munoz/claim');
    const token = seat.body.token as string;
    const replies = await Promise.all([
      ...Array.from({ length: 5 }, () =>
        api.call('POST', `/overlaps/${overlap.id}/vote`, {
          token,
          body: { kind: 'se_tocan' },
        }),
      ),
      ...Array.from({ length: 5 }, () =>
        api.call('POST', `/overlaps/${overlap.id}/vote`, {
          ...asSeat('javier-munoz'),
          body: { kind: 'se_tocan' },
        }),
      ),
    ]);
    const counts = countBy(replies, (reply) => reply.status);
    expect(counts['200']).toBe(5);
    expect(counts['409']).toBe(5);
    expect(await api.prisma.overlapVote.count()).toBe(1);
    expect(await voted(api)).toBe(1);
  });
  it('con 6 respuestas simultáneas de un revisor a su aviso queda una sola reseña', async () => {
    await armOverlap(api);
    const list = await api.call('GET', '/proposals?status=active');
    const reviewer = list.body.proposals
      .flatMap(
        (proposal: {
          reviewers: { stakeholderId: string; notificationId: string | null }[];
        }) => proposal.reviewers,
      )
      .find(
        (item: { notificationId: string | null }) => item.notificationId,
      ) as { stakeholderId: string; notificationId: string };
    expect(reviewer).toBeDefined();
    const replies = await parallel(6, (index) =>
      api.call('POST', `/notifications/${reviewer.notificationId}/response`, {
        ...asSeat(reviewer.stakeholderId, `resena-${index}`),
        body: { kind: 'reviewed', note: 'Revisado' },
      }),
    );
    expect(replies.filter((reply) => reply.status >= 500)).toEqual([]);
    const decided = await api.prisma.review.findMany({
      where: { reviewerId: reviewer.stakeholderId, decision: { not: null } },
    });
    expect(decided).toHaveLength(1);
    expect(decided[0]?.note).toBe('Revisado');
  });
});
