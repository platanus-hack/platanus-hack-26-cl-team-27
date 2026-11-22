import { PairedConflictEstimator } from '../../src/infra/adapters/PairedConflictEstimator.ts';
import { vocabulary } from '../support.ts';

const brief = (id: string) => ({
  id,
  subjectId: id,
  summary: id,
  detectedAt: '2026-11-22T00:00:00Z',
});

describe('PairedConflictEstimator', () => {
  it('da el mismo veredicto para A frente a B que para B frente a A, y no vuelve a preguntar', async () => {
    const asked: string[][] = [];
    const inner = {
      estimate: vi.fn(
        async (query: {
          change: { id: string };
          others: readonly { id: string }[];
        }) => {
          asked.push([
            query.change.id,
            ...query.others.map((other) => other.id),
          ]);
          return query.others.map((other) => ({
            otherChangeId: other.id,
            probability: query.change.id === 'a' ? 0.8 : 0.2,
            reason: 'r',
            question: 'q',
          }));
        },
      ),
    };
    const paired = new PairedConflictEstimator(inner);

    await paired.estimate({
      change: brief('a'),
      others: [brief('b')],
      vocabulary,
    });
    const reverse = await paired.estimate({
      change: brief('b'),
      others: [brief('a'), brief('c')],
      vocabulary,
    });

    expect(asked).toEqual([
      ['a', 'b'],
      ['b', 'c'],
    ]);
    expect(
      reverse.find((item) => item.otherChangeId === 'a')?.probability,
    ).toBe(0.8);
    expect(
      reverse.find((item) => item.otherChangeId === 'c')?.probability,
    ).toBe(0.2);
  });
});
