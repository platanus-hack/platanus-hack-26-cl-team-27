import {
  applyReview,
  decideProposal,
  excuseReviewer,
  isActive,
  reopenFor,
} from '../../src/domain/Proposal.ts';
import { at, proposal, review } from '../factories.ts';

describe('decideProposal', () => {
  it.each([
    [
      'todos aprueban',
      [review('a', 'approve'), review('b', 'approve')],
      'merged',
    ],
    ['falta uno', [review('a', 'approve'), review('b')], 'open'],
    ['nadie respondió', [review('a'), review('b')], 'open'],
    [
      'uno disputa',
      [review('a', 'approve'), review('b', 'dispute')],
      'disputed',
    ],
    [
      'una disputa pesa más que un pendiente',
      [review('a'), review('b', 'dispute')],
      'disputed',
    ],
    ['cero revisores', [], 'merged'],
  ] as const)('%s', (_name, reviews, expected) => {
    expect(decideProposal({ reviews })).toBe(expected);
  });
});

describe('applyReview y reopenFor', () => {
  it('aplica el voto solo al revisor', () => {
    const next = applyReview(proposal('p'), 'paula', 'approve', 'ok', at(3));
    expect(next.reviews).toEqual([
      { reviewerId: 'paula', decision: 'approve', note: 'ok', at: at(3) },
      review('javier'),
    ]);
  });

  it('reabrir limpia solo a quien disputó y conserva las aprobaciones', () => {
    const disputed = proposal('p', {
      status: 'disputed',
      reviews: [
        review('paula', 'dispute'),
        review('javier', 'approve'),
        review('camila'),
      ],
    });
    const { proposal: next, reopened } = reopenFor(disputed);
    expect(reopened).toEqual(['paula']);
    expect(next.status).toBe('open');
    expect(next.reviews.find((r) => r.reviewerId === 'paula')).toEqual({
      reviewerId: 'paula',
      decision: null,
      note: null,
      at: null,
    });
    expect(next.reviews.find((r) => r.reviewerId === 'javier')?.decision).toBe(
      'approve',
    );
  });

  it('solo están activas las propuestas abiertas o en disputa', () => {
    expect(
      (['open', 'disputed', 'merged', 'withdrawn', 'superseded'] as const).map(
        (status) => isActive({ status }),
      ),
    ).toEqual([true, true, false, false, false]);
  });
});

describe('excuseReviewer', () => {
  it('saca al revisor y lo deja como filtrado con su motivo, y el resto decide', () => {
    const voted = applyReview(proposal('p'), 'javier', 'approve', null, at(2));
    const next = excuseReviewer(voted, 'paula', 'No calculo ese shaft', at(3));

    expect(next.reviews.map((item) => item.reviewerId)).toEqual(['javier']);
    expect(next.filtered).toEqual([
      {
        id: 'paula',
        reason: 'No calculo ese shaft',
        notAffected: true,
        at: at(3).toISOString(),
      },
    ]);
    expect(decideProposal(next)).toBe('merged');
    expect(decideProposal(excuseReviewer(proposal('p'), 'paula', 'x'))).toBe(
      'open',
    );
  });
});
