import { describe, expect, it } from 'vitest';

import {
  actionsFor,
  changeOf,
  disputersOf,
  lastActivity,
  splitProposals,
  statusLabel,
  toProposalStatus,
  type ProposalReviewer,
  type ProposalView,
} from './proposals-api';

const reviewer = (
  stakeholderId: string,
  decision: ProposalReviewer['decision'],
  at: string | null,
  note: string | null = null,
): ProposalReviewer => ({
  stakeholderId,
  name: stakeholderId,
  role: 'Rol',
  channel: 'email',
  notificationId: `n-${stakeholderId}`,
  decision,
  note,
  at,
});

const proposal = (overrides: Partial<ProposalView> = {}): ProposalView => ({
  id: 'p1',
  changeId: 'c1',
  title: 'Losa nivel 3 · Espesor: 15 cm → 20 cm',
  status: 'open',
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
  reviewers: [],
  filtered: [],
  progress: { approved: 0, required: 0, missing: [] },
  backedBy: [],
  ...overrides,
});

describe('lastActivity', () => {
  it('toma el voto más reciente', () => {
    const view = proposal({
      reviewers: [
        reviewer('paula', 'dispute', '2026-11-21T10:05:00Z'),
        reviewer('javier', 'approve', '2026-11-21T10:02:00Z'),
        reviewer('marcos', null, null),
      ],
    });
    expect(lastActivity(view)).toBe('2026-11-21T10:05:00Z');
  });

  it('usa la apertura cuando nadie respondió', () => {
    expect(lastActivity(proposal())).toBe('2026-11-21T10:00:00Z');
  });
});

describe('actionsFor', () => {
  it('reabre solo en disputa y retira solo lo activo', () => {
    expect(actionsFor('disputed')).toEqual({ reopen: true, withdraw: true });
    expect(actionsFor('open')).toEqual({ reopen: false, withdraw: true });
    expect(actionsFor('merged')).toEqual({ reopen: false, withdraw: false });
    expect(actionsFor('withdrawn')).toEqual({ reopen: false, withdraw: false });
  });
});

describe('splitProposals', () => {
  it('separa lo activo del historial, lo más reciente primero', () => {
    const merged = proposal({
      id: 'old',
      status: 'merged',
      mergedAt: '2026-11-21T09:00:00Z',
      openedAt: '2026-11-21T08:00:00Z',
    });
    const open = proposal({ id: 'a', openedAt: '2026-11-21T10:00:00Z' });
    const disputed = proposal({
      id: 'b',
      status: 'disputed',
      openedAt: '2026-11-21T09:30:00Z',
      reviewers: [reviewer('paula', 'dispute', '2026-11-21T10:10:00Z')],
    });
    const { active, history } = splitProposals([merged, open, disputed]);
    expect(active.map((item) => item.id)).toEqual(['b', 'a']);
    expect(history.map((item) => item.id)).toEqual(['old']);
  });
});

describe('disputersOf', () => {
  it('devuelve solo a quienes disputan, con su nota', () => {
    const view = proposal({
      reviewers: [
        reviewer('paula', 'dispute', '2026-11-21T10:05:00Z', 'Necesito 2 días'),
        reviewer('javier', 'approve', '2026-11-21T10:02:00Z'),
      ],
    });
    expect(disputersOf(view).map((item) => item.note)).toEqual([
      'Necesito 2 días',
    ]);
  });
});

describe('estados', () => {
  it('traduce los estados, incluido el reemplazo del lago', () => {
    expect(statusLabel('merged')).toBe('Fusionada');
    expect(statusLabel('superseded')).toBe('Reemplazada');
    expect(toProposalStatus('superseded')).toBe('replaced');
    expect(toProposalStatus('desconocido')).toBeNull();
  });
});

describe('changeOf', () => {
  it('resume el antes y el después de cada atributo', () => {
    expect(changeOf(proposal())).toBe('15 cm → 20 cm');
  });
});
