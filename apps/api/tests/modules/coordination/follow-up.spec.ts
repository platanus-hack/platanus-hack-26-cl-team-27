import type { Overlap, Proposal } from '@team27/context-lake';
import type { Notification } from '@team27/context-notification';

import {
  awaitingNotices,
  escalationsOf,
} from '../../../src/modules/coordination/follow-up.ts';
import { project } from '../../project.ts';

const at = new Date('2026-11-22T12:00:00Z');

const proposal = (overrides: Partial<Proposal> = {}): Proposal => ({
  id: 'p1',
  changeId: 'c1',
  changeIds: ['c1'],
  documentId: 'a201',
  sourceRevisionId: 'r1',
  authorId: 'fernanda-lagos',
  changes: [],
  context: [],
  status: 'open',
  reviews: [
    { reviewerId: 'paula-rojas', decision: null, note: null, at: null },
    { reviewerId: 'javier-munoz', decision: 'approve', note: null, at },
  ],
  filtered: [],
  openedAt: at,
  resolvedAt: null,
  supersededById: null,
  ...overrides,
});

const overlap = (overrides: Partial<Overlap> = {}): Overlap => ({
  id: 'o1',
  proposalId: 'p1',
  otherProposalId: null,
  revisionId: 'r1',
  chunkLocator: 'x',
  kind: 'misma-area',
  area: null,
  relation: null,
  subjectId: 'shaft-s1',
  otherSubjectId: 'colector-b2',
  otherBacking: {
    documentId: 'is301',
    label: 'rev A',
    ownerId: 'javier-munoz',
  },
  validators: ['fernanda-lagos', 'javier-munoz'],
  status: 'abierto',
  votes: [{ validatorId: 'javier-munoz', kind: 'no_se_tocan', note: null, at }],
  resolution: null,
  createdAt: at,
  resolvedAt: null,
  ...overrides,
});

const change = (stakeholderId: string): Notification => ({
  id: `n-${stakeholderId}`,
  changeId: 'c1',
  stakeholderId,
  channel: 'email',
  title: 'Shaft S1',
  findings: [],
  link: '/proyectos/los-aromos/cambios/c1',
  context: null,
  sentAt: at,
  response: null,
});

const conflict = (stakeholderId: string, votes: boolean): Notification => ({
  ...change(stakeholderId),
  id: `k-${stakeholderId}`,
  context: {
    kind: 'conflict',
    role: '',
    recipientName: '',
    impact: null,
    clashes: [],
    conflict: {
      overlapId: 'o1',
      first: 'A',
      firstSource: 'a',
      second: 'B',
      secondSource: 'b',
      area: null,
      question: '¿?',
      combined: null,
      part: votes ? 'author' : 'affected',
      votes,
    },
  },
});

const notifications = [
  change('paula-rojas'),
  change('javier-munoz'),
  conflict('fernanda-lagos', true),
  conflict('javier-munoz', true),
  conflict('paula-rojas', false),
];

const ids = (list: readonly Notification[]) => list.map((item) => item.id);

describe('qué avisos siguen esperando respuesta', () => {
  it('el revisor que no responde y el validador que no vota; no quien ya respondió ni quien solo mira', () => {
    expect(
      ids(
        awaitingNotices({
          notifications,
          proposals: [proposal()],
          overlaps: [overlap()],
        }),
      ),
    ).toEqual(['n-paula-rojas', 'k-fernanda-lagos']);
  });

  it('una propuesta cerrada o un solapamiento resuelto ya no esperan a nadie', () => {
    expect(
      awaitingNotices({
        notifications,
        proposals: [proposal({ status: 'superseded' })],
        overlaps: [overlap({ status: 'resuelto' })],
      }),
    ).toEqual([]);
  });

  it('un aviso con respuesta no espera', () => {
    expect(
      awaitingNotices({
        notifications: [
          {
            ...change('paula-rojas'),
            response: { kind: 'reviewed', note: null, at },
          },
        ],
        proposals: [proposal()],
        overlaps: [],
      }),
    ).toEqual([]);
  });
});

describe('a quién se escala', () => {
  it('junta por cambio a quienes no responden, con el autor de la propuesta', () => {
    const [escalation, ...rest] = escalationsOf(
      project,
      [
        { notification: change('paula-rojas'), step: 'escalate', reminders: 2 },
        { notification: change('javier-munoz'), step: 'remind', reminders: 1 },
      ],
      [proposal()],
    );

    expect(rest).toEqual([]);
    expect(escalation).toMatchObject({
      changeId: 'c1',
      authorId: 'fernanda-lagos',
      pending: [{ id: 'paula-rojas', name: 'Paula Rojas', reminders: 2 }],
    });
  });
});
