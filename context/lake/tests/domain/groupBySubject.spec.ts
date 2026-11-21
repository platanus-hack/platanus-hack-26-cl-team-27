import { classifyClaims } from '../../src/domain/classifyClaims.ts';
import { groupBySubject } from '../../src/domain/groupBySubject.ts';
import { claim, entry } from '../factories.ts';

const baseline = [
  entry('losa-n3', 'espesor_cm', 15),
  entry('losa-n3', 'largo_m', 8),
  entry('ventanas-norte', 'ancho_cm', 120),
  entry('ventanas-norte', 'alto_cm', 150),
];

describe('groupBySubject', () => {
  it('arma un borrador por sujeto con antes y después completos', () => {
    const outcomes = classifyClaims({
      kind: 'plano',
      claims: [
        claim('c1', 'r1', 'losa-n3', 'espesor_cm', 20),
        claim('c2', 'r1', 'ventanas-norte', 'ancho_cm', 150),
        claim('c3', 'r1', 'ventanas-norte', 'alto_cm', 150),
      ],
      baseline,
      proposals: [],
      discrepancies: [],
    });
    const drafts = groupBySubject(outcomes, baseline, {
      revisionId: 'r1',
      authorId: 'fernanda',
    });
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({
      subject: 'losa-n3',
      sourceRevisionId: 'r1',
      authorId: 'fernanda',
      before: { espesor_cm: 15, largo_m: 8 },
      after: { espesor_cm: 20, largo_m: 8 },
    });
    expect(drafts[0]?.changes).toEqual([
      {
        attribute: 'espesor_cm',
        unit: null,
        before: 15,
        after: 20,
        claimId: 'c1',
      },
    ]);
    expect(drafts[1]?.after).toEqual({ ancho_cm: 150, alto_cm: 150 });
  });

  it('no abre borradores si nada cambia', () => {
    const outcomes = classifyClaims({
      kind: 'plano',
      claims: [claim('c1', 'r1', 'losa-n3', 'espesor_cm', 15)],
      baseline,
      proposals: [],
      discrepancies: [],
    });
    expect(
      groupBySubject(outcomes, baseline, { revisionId: 'r1', authorId: 'f' }),
    ).toEqual([]);
  });
});
