import type { ProposalView } from '../src/load/api.ts';
import {
  delayFor,
  disputeNotice,
  planReopens,
  planVote,
  planVotes,
  scaled,
  voteKey,
} from '../src/players/plan.ts';

const proposal = (overrides: Partial<ProposalView> = {}): ProposalView => ({
  id: 'p1',
  title: 'Losa nivel 3 · Espesor: 15 cm → 20 cm',
  status: 'open',
  subjectId: 'losa-n3',
  costDelta: 0,
  delayDays: 0,
  filtered: [],
  reviewers: [
    {
      stakeholderId: 'paula-rojas',
      name: 'Paula Rojas',
      notificationId: 'n-paula',
      decision: null,
      note: null,
    },
    {
      stakeholderId: 'daniela-soto',
      name: 'Daniela Soto',
      notificationId: 'n-daniela',
      decision: null,
      note: null,
    },
    {
      stakeholderId: 'javier-munoz',
      name: 'Javier Muñoz',
      notificationId: 'n-javier',
      decision: null,
      note: null,
    },
  ],
  ...overrides,
});

const context = (
  proposals: ProposalView[],
  extra: Partial<Parameters<typeof planVotes>[0]> = {},
) => ({
  proposals,
  humans: new Set<string>(),
  rounds: new Map<string, number>(),
  planned: new Set<string>(),
  speed: 1,
  ...extra,
});

describe('retardos', () => {
  it('escala por velocidad', () => {
    expect(scaled(4000, 4)).toBe(1000);
    expect(scaled(2500, 2)).toBe(1250);
    expect(scaled(3000, 1)).toBe(3000);
  });

  it('usa el retardo de cada asiento y 3 s por defecto', () => {
    expect(delayFor('tomas-reyes')).toBe(6000);
    expect(delayFor('alguien-mas')).toBe(3000);
  });
});

describe('planVote', () => {
  it('Paula disputa la losa y aprueba tras reabrir', () => {
    const first = planVote({
      castId: 'paula-rojas',
      subjectId: 'losa-n3',
      round: 0,
    });
    expect(first).toEqual({
      kind: 'issue',
      note: 'Necesito 2 días para recalcular las vigas y pilares que reciben la losa',
      delayMs: 2500,
    });
    expect(
      planVote({ castId: 'paula-rojas', subjectId: 'losa-n3', round: 1 }),
    ).toEqual({
      kind: 'reviewed',
      note: 'Recalculado, queda conforme',
      delayMs: 3000,
    });
  });

  it('Javier disputa el shaft y aprueba tras reabrir', () => {
    expect(
      planVote({ castId: 'javier-munoz', subjectId: 'shaft-s1', round: 0 })
        .kind,
    ).toBe('issue');
    expect(
      planVote({ castId: 'javier-munoz', subjectId: 'shaft-s1', round: 2 })
        .note,
    ).toBe('Resuelto el cruce con el colector, queda conforme');
  });

  it('Paula aprueba lo que no es la losa y Javier lo que no es el shaft', () => {
    expect(
      planVote({
        castId: 'paula-rojas',
        subjectId: 'ventanas-norte',
        round: 0,
      }),
    ).toEqual({
      kind: 'reviewed',
      note: 'Revisado, sin observaciones.',
      delayMs: 2500,
    });
    expect(
      planVote({ castId: 'javier-munoz', subjectId: 'losa-n3', round: 0 }).kind,
    ).toBe('reviewed');
  });

  it('los demás aprueban con su nota', () => {
    expect(
      planVote({ castId: 'camila-vera', subjectId: 'shaft-s1', round: 0 }),
    ).toEqual({
      kind: 'reviewed',
      note: 'Conforme con las canalizaciones.',
      delayMs: 5000,
    });
  });
});

describe('planVotes', () => {
  it('planifica un voto por revisor pendiente con su aviso y su retardo', () => {
    const votes = planVotes(context([proposal()], { speed: 2 }));
    expect(
      votes.map((vote) => [
        vote.castId,
        vote.kind,
        vote.notificationId,
        vote.delayMs,
      ]),
    ).toEqual([
      ['paula-rojas', 'issue', 'n-paula', 1250],
      ['daniela-soto', 'reviewed', 'n-daniela', 1500],
      ['javier-munoz', 'reviewed', 'n-javier', 2000],
    ]);
  });

  it('salta a los asientos con una persona', () => {
    const votes = planVotes(
      context([proposal()], { humans: new Set(['paula-rojas']) }),
    );
    expect(votes.map((vote) => vote.castId)).toEqual([
      'daniela-soto',
      'javier-munoz',
    ]);
  });

  it('no repite lo ya planificado ni a quien ya votó ni propuestas cerradas', () => {
    const base = proposal();
    const planned = new Set([voteKey('p1', 'paula-rojas', 0)]);
    const voted = proposal({
      reviewers: base.reviewers.map((reviewer) =>
        reviewer.stakeholderId === 'daniela-soto'
          ? { ...reviewer, decision: 'approve' as const }
          : reviewer,
      ),
    });
    expect(
      planVotes(context([voted], { planned })).map((vote) => vote.castId),
    ).toEqual(['javier-munoz']);
    expect(planVotes(context([proposal({ status: 'merged' })]))).toEqual([]);
    expect(planVotes(context([proposal({ status: 'withdrawn' })]))).toEqual([]);
  });

  it('en la ronda 1 la disputa aprueba y la clave cambia', () => {
    const votes = planVotes(
      context([proposal()], { rounds: new Map([['p1', 1]]) }),
    );
    const paula = votes.find((vote) => vote.castId === 'paula-rojas')!;
    expect(paula.kind).toBe('reviewed');
    expect(paula.key).toBe('vote:p1:paula-rojas:1');
  });

  it('ignora a quien aún no tiene aviso', () => {
    const base = proposal();
    const open = proposal({
      reviewers: [{ ...base.reviewers[0]!, notificationId: null }],
    });
    expect(planVotes(context([open]))).toEqual([]);
  });
});

describe('reapertura', () => {
  const disputed = proposal({
    status: 'disputed',
    reviewers: [
      {
        stakeholderId: 'paula-rojas',
        name: 'Paula Rojas',
        notificationId: 'n',
        decision: 'dispute',
        note: 'Necesito 2 días',
      },
    ],
  });

  it('en automático Fernanda reabre a los 4 s escalados', () => {
    const reopens = planReopens({
      proposals: [disputed],
      rounds: new Map(),
      planned: new Set(),
      speed: 4,
      authorHeld: false,
    });
    expect(reopens).toEqual([
      { key: 'reopen:p1:0', proposalId: 'p1', delayMs: 1000 },
    ]);
  });

  it('no reabre si Fernanda la juega una persona, ni dos veces la misma ronda', () => {
    const input = {
      proposals: [disputed],
      rounds: new Map<string, number>(),
      planned: new Set<string>(),
      speed: 1,
    };
    expect(planReopens({ ...input, authorHeld: true })).toEqual([]);
    expect(
      planReopens({
        ...input,
        planned: new Set(['reopen:p1:0']),
        authorHeld: false,
      }),
    ).toEqual([]);
  });

  it('avisa quién disputó para reabrir a mano', () => {
    expect(disputeNotice(disputed, new Map())).toEqual({
      key: 'notice:p1:0',
      text: 'Paula Rojas disputó: «Necesito 2 días» — [o] reabrir',
    });
    expect(disputeNotice(proposal(), new Map())).toBeNull();
  });
});
