import type { OverlapView, ProposalView } from '../src/load/api.ts';
import {
  delayFor,
  describeOverlap,
  disputeNotice,
  hasBlockers,
  overlapNotices,
  planOverlapVotes,
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

  it('Javier ya no disputa la propuesta del shaft: lo detecta el solapamiento', () => {
    expect(
      planVote({ castId: 'javier-munoz', subjectId: 'shaft-s1', round: 0 })
        .kind,
    ).toBe('reviewed');
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

const overlap = (overrides: Partial<OverlapView> = {}): OverlapView => ({
  id: 'o1',
  proposalId: 'p-shaft',
  revisionId: 'r-a201d',
  chunkLocator: 'detalle shaft S1',
  kind: 'misma-area',
  area: { nivel: 'n3', celda: 'C-D/3', sistemas: ['sanitarias'] },
  subjectId: 'shaft-s1',
  otherSubjectId: 'colector-b2',
  otherBacking: {
    documentId: 'is301',
    label: 'rev A',
    ownerId: 'javier-munoz',
  },
  status: 'abierto',
  validators: ['fernanda-lagos', 'javier-munoz'],
  votes: [],
  ...overrides,
});

describe('solapamientos', () => {
  it('Javier vota se_tocan con su nota y Fernanda no_se_tocan', () => {
    const votes = planOverlapVotes({
      overlaps: [overlap()],
      humans: new Set(),
      planned: new Set(),
      speed: 2,
    });
    expect(
      votes.map((vote) => [vote.castId, vote.kind, vote.note, vote.delayMs]),
    ).toEqual([
      [
        'fernanda-lagos',
        'no_se_tocan',
        'Desde arquitectura no veo el cruce',
        500,
      ],
      [
        'javier-munoz',
        'se_tocan',
        'El shaft a 8,5 m cruza el colector B2 en el nivel 3',
        2000,
      ],
    ]);
  });

  it('salta a las personas, a quien ya votó y a lo ya planificado', () => {
    const votes = planOverlapVotes({
      overlaps: [
        overlap({
          votes: [
            { validatorId: 'fernanda-lagos', kind: 'no_se_tocan', note: null },
          ],
        }),
        overlap({ id: 'o2', status: 'confirmado' }),
      ],
      humans: new Set(['javier-munoz']),
      planned: new Set(),
      speed: 1,
    });
    expect(votes).toEqual([]);
    expect(
      planOverlapVotes({
        overlaps: [overlap()],
        humans: new Set(),
        planned: new Set(['overlap-vote:o1:javier-munoz']),
        speed: 1,
      }).map((vote) => vote.castId),
    ).toEqual(['fernanda-lagos']);
  });

  it('describe el solapamiento y su resolución', () => {
    const labels = new Map([['r-a201d', 'A-201 rev D']]);
    expect(describeOverlap(overlap(), labels)).toBe(
      'Solapamiento: Shaft S1 (A-201 rev D) y Colector B2 (IS-301 rev A) · nivel 3 · C-D/3 · sanitarias',
    );
    expect(describeOverlap(overlap({ status: 'resuelto' }), labels)).toContain(
      'Solapamiento resuelto: Shaft S1',
    );
    expect(
      describeOverlap(
        overlap({
          status: 'confirmado',
          votes: [
            {
              validatorId: 'javier-munoz',
              kind: 'se_tocan',
              note: 'cruza',
            },
          ],
        }),
        labels,
      ),
    ).toMatch(/^Solapamiento confirmado: .* — «cruza»$/);
  });

  it('avisa cada estado una sola vez', () => {
    const labels = new Map<string, string>();
    const first = overlapNotices([overlap()], labels, new Set());
    expect(first).toHaveLength(1);
    expect(
      overlapNotices([overlap()], labels, new Set([first[0]!.key])),
    ).toEqual([]);
    expect(
      overlapNotices(
        [overlap({ status: 'resuelto' })],
        labels,
        new Set([first[0]!.key]),
      ),
    ).toHaveLength(1);
  });

  const approved = (status = 'open'): ProposalView =>
    proposal({
      status,
      reviewers: proposal().reviewers.map((reviewer) => ({
        ...reviewer,
        decision: 'approve' as const,
      })),
    });

  it('un solapamiento abierto bloquea el paso', () => {
    expect(
      hasBlockers({
        proposals: [],
        overlaps: [overlap()],
        deferConfirmed: true,
      }),
    ).toBe(true);
  });

  it('el confirmado solo espera un paso posterior si queda alguno', () => {
    const confirmed = overlap({ status: 'confirmado' });
    expect(
      hasBlockers({
        proposals: [approved()],
        overlaps: [confirmed],
        deferConfirmed: true,
      }),
    ).toBe(false);
    expect(
      hasBlockers({
        proposals: [approved()],
        overlaps: [confirmed],
        deferConfirmed: false,
      }),
    ).toBe(true);
  });

  it('una propuesta con votos pendientes o disputada sigue bloqueando', () => {
    const confirmed = overlap({ status: 'confirmado' });
    expect(
      hasBlockers({
        proposals: [proposal()],
        overlaps: [confirmed],
        deferConfirmed: true,
      }),
    ).toBe(true);
    expect(
      hasBlockers({
        proposals: [approved('disputed')].map((p) => ({
          ...p,
          reviewers: p.reviewers.map((r, i) =>
            i === 0 ? { ...r, decision: 'dispute' as const } : r,
          ),
        })),
        overlaps: [confirmed],
        deferConfirmed: true,
      }),
    ).toBe(true);
  });

  it('sin solapamientos una propuesta abierta bloquea y una fusionada no', () => {
    expect(
      hasBlockers({
        proposals: [approved()],
        overlaps: [],
        deferConfirmed: true,
      }),
    ).toBe(true);
    expect(
      hasBlockers({
        proposals: [approved('merged')],
        overlaps: [overlap({ status: 'resuelto' })],
        deferConfirmed: false,
      }),
    ).toBe(false);
  });
});
