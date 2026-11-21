import { describe, expect, it } from 'vitest';

import {
  groupInbox,
  isPending,
  publicInbox,
  type InboxDiscrepancy,
  type InboxFiltered,
  type InboxStale,
  type InboxVote,
} from './inbox-api';
import type { ProposalView } from './proposals-api';
import type { SpaceView } from './spaces-api';

const vote = (overrides: Partial<InboxVote> = {}): InboxVote => ({
  type: 'vote',
  id: 'n1',
  notificationId: 'n1',
  proposalId: 'p1',
  changeId: 'c1',
  title: 'Losa nivel 3 · Espesor: 15 cm → 20 cm',
  sentAt: '2026-11-21T10:00:00Z',
  findings: [],
  costDelta: 3_636_500,
  delayDays: 1,
  progress: { approved: 0, required: 4, missing: [] },
  status: 'open',
  response: null,
  link: '/cambios/c1?para=paula-rojas',
  ...overrides,
});

const discrepancy: InboxDiscrepancy = {
  type: 'discrepancy',
  id: 'd1',
  subjectName: 'Ventanas norte',
  label: 'Ancho',
  claimedValue: 150,
  currentValue: 120,
  unit: 'cm',
  sourceTitle: 'Mensaje 2',
  spaceName: 'WhatsApp Obra Los Aromos',
  authorName: 'Marcos Fuentes',
  at: '2026-11-21T10:20:00Z',
};

const stale: InboxStale = {
  type: 'stale',
  id: 's1',
  documentId: 'eett-03',
  documentTitle: 'EETT-03 Hormigones',
  revisionId: 'r1',
  revisionLabel: 'rev A',
  subjectId: 'losa-n3',
  attribute: 'espesor_cm',
  label: 'Losa nivel 3 · Espesor',
  usedValue: 15,
  currentValue: 20,
  unit: 'cm',
  at: null,
};

const filtered: InboxFiltered = {
  type: 'filtered',
  id: 'f1',
  proposalId: 'p2',
  changeId: 'c2',
  title: 'Ventanas norte · Ancho: 120 cm → 150 cm',
  reason: 'la holgura lo absorbe',
  at: '2026-11-21T10:30:00Z',
};

describe('isPending', () => {
  it('un voto sin respuesta está pendiente solo mientras la propuesta siga activa', () => {
    expect(isPending(vote())).toBe(true);
    expect(isPending(vote({ status: 'disputed' }))).toBe(true);
    expect(isPending(vote({ status: 'merged' }))).toBe(false);
    expect(isPending(vote({ status: 'withdrawn' }))).toBe(false);
    expect(isPending(vote({ status: 'replaced' }))).toBe(false);
  });

  it('un voto respondido ya no está pendiente', () => {
    expect(
      isPending(
        vote({
          response: {
            kind: 'reviewed',
            note: null,
            at: '2026-11-21T10:01:00Z',
          },
        }),
      ),
    ).toBe(false);
  });

  it('las discrepancias y los desfases esperan acción; los filtrados no', () => {
    expect(isPending(discrepancy)).toBe(true);
    expect(isPending(stale)).toBe(true);
    expect(isPending(filtered)).toBe(false);
  });
});

describe('groupInbox', () => {
  it('ordena lo pendiente por tipo y deja aparte lo informativo y lo respondido', () => {
    const answered = vote({
      id: 'n0',
      response: {
        kind: 'issue',
        note: 'Necesito 2 días',
        at: '2026-11-21T10:05:00Z',
      },
    });
    const groups = groupInbox([stale, filtered, answered, discrepancy, vote()]);
    expect(groups.pending.map((item) => item.type)).toEqual([
      'vote',
      'discrepancy',
      'stale',
    ]);
    expect(groups.info.map((item) => item.id)).toEqual(['f1']);
    expect(groups.answered.map((item) => item.id)).toEqual(['n0']);
  });
});

const proposal: ProposalView = {
  id: 'p1',
  changeId: 'c1',
  title: 'Losa nivel 3 · Espesor: 15 cm → 20 cm',
  status: 'disputed',
  elementName: 'Losa nivel 3',
  subjectId: 'losa-n3',
  attribute: 'espesor_cm',
  diffs: [{ label: 'Espesor', unit: 'cm', before: 15, after: 20 }],
  costDelta: 3_636_500,
  delayDays: 1,
  authorId: 'fernanda-lagos',
  authorName: 'Fernanda Lagos',
  openedAt: '2026-11-21T10:00:00Z',
  mergedAt: null,
  reviewers: [
    {
      stakeholderId: 'paula-rojas',
      name: 'Paula Rojas',
      role: 'Ingeniera calculista',
      channel: 'email',
      notificationId: 'n-paula',
      decision: 'dispute',
      note: 'Necesito 2 días',
      at: '2026-11-21T10:05:00Z',
    },
  ],
  filtered: [
    {
      stakeholderId: 'marcos-fuentes',
      name: 'Marcos Fuentes',
      reason: 'holgura',
    },
  ],
  progress: { approved: 0, required: 1, missing: ['Paula Rojas'] },
  backedBy: [],
};

const spaces: SpaceView[] = [
  {
    id: 'drive',
    name: 'Drive del proyecto',
    kind: 'drive',
    ownerId: 'fernanda-lagos',
    ownerName: 'Fernanda Lagos',
    documents: [
      {
        id: 'eett-03',
        title: 'EETT-03 Hormigones',
        kind: 'eett',
        state: 'stale',
        ownerId: 'paula-rojas',
        ownerName: 'Paula Rojas',
        staleFacts: [
          {
            subjectId: 'losa-n3',
            attribute: 'espesor_cm',
            label: 'Losa nivel 3 · Espesor',
            usedValue: 15,
            currentValue: 20,
            unit: 'cm',
          },
        ],
        acknowledgedNote: null,
        revisions: [
          {
            id: 'r-eett-a',
            label: 'rev A',
            title: 'EETT-03 Hormigones',
            pointer: 'Drive/EETT-03_revA.md',
            author: { id: 'paula-rojas', name: 'Paula Rojas' },
            capturedAt: '2026-11-21T09:00:00Z',
            current: true,
            claims: [],
          },
        ],
      },
    ],
  },
];

describe('publicInbox', () => {
  it('arma la bandeja de solo lectura con lo público de la sala', () => {
    const items = publicInbox('paula-rojas', [proposal], spaces);
    const [voteItem, staleItem] = items;
    expect(items.map((item) => item.type)).toEqual(['vote', 'stale']);
    expect(voteItem).toMatchObject({
      notificationId: 'n-paula',
      status: 'disputed',
      response: { kind: 'issue', note: 'Necesito 2 días' },
      link: '/cambios/c1?para=paula-rojas',
    });
    expect(staleItem).toMatchObject({
      revisionId: 'r-eett-a',
      usedValue: 15,
      currentValue: 20,
    });
  });

  it('muestra el filtrado a quien quedó fuera y nada a quien no participa', () => {
    expect(publicInbox('marcos-fuentes', [proposal], spaces)).toMatchObject([
      { type: 'filtered', reason: 'holgura', changeId: 'c1' },
    ]);
    expect(publicInbox('camila-vera', [proposal], spaces)).toEqual([]);
  });
});
