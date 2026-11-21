import { describe, expect, it } from 'vitest';

import { attentionItems } from './attention';
import type { InboxDiscrepancy } from './inbox-api';
import type { ProposalView } from './proposals-api';

const proposal = (
  id: string,
  status: ProposalView['status'],
  at: string,
): ProposalView => ({
  id,
  changeId: `c-${id}`,
  title: id,
  status,
  elementName: id,
  subjectId: id,
  attribute: 'espesor_cm',
  diffs: [],
  costDelta: 0,
  delayDays: 0,
  authorId: 'fernanda-lagos',
  authorName: 'Fernanda Lagos',
  openedAt: at,
  mergedAt: null,
  reviewers: [
    {
      stakeholderId: 'paula-rojas',
      name: 'Paula Rojas',
      role: 'Ingeniera calculista',
      channel: 'email',
      notificationId: 'n1',
      decision: status === 'disputed' ? 'dispute' : null,
      note: status === 'disputed' ? 'Necesito 2 días' : null,
      at: status === 'disputed' ? at : null,
    },
  ],
  filtered: [],
  progress: { approved: 0, required: 1, missing: ['Paula Rojas'] },
  backedBy: [],
});

const discrepancy = (id: string, at: string): InboxDiscrepancy => ({
  type: 'discrepancy',
  id,
  subjectName: 'Ventanas norte',
  label: 'Ancho',
  claimedValue: 150,
  currentValue: 120,
  unit: 'cm',
  sourceTitle: 'Mensaje 2',
  spaceName: 'WhatsApp Obra Los Aromos',
  authorName: 'Marcos Fuentes',
  at,
});

describe('attentionItems', () => {
  it('pone primero las disputas y después las discrepancias, lo más nuevo arriba', () => {
    const items = attentionItems(
      [
        discrepancy('d-old', '2026-11-21T10:00:00Z'),
        discrepancy('d-new', '2026-11-21T10:30:00Z'),
      ],
      [
        proposal('open', 'open', '2026-11-21T10:40:00Z'),
        proposal('disputed', 'disputed', '2026-11-21T10:10:00Z'),
      ],
    );
    expect(items.map((item) => item.id)).toEqual([
      'disputed',
      'd-new',
      'd-old',
    ]);
  });

  it('trae la nota de quien disputa', () => {
    const [item] = attentionItems(
      [],
      [proposal('disputed', 'disputed', '2026-11-21T10:10:00Z')],
    );
    expect(item?.kind === 'dispute' && item.disputers[0]?.note).toBe(
      'Necesito 2 días',
    );
  });
});
