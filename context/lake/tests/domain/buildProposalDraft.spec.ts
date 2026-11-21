import { buildProposalDraft } from '../../src/domain/buildProposalDraft.ts';
import { classifyClaims } from '../../src/domain/classifyClaims.ts';
import { claim, entry, hunk, proposal } from '../factories.ts';

const baseline = [
  entry('losa-n3', 'espesor_cm', 15),
  entry('losa-n3', 'largo_m', 8),
  entry('ventanas-norte', 'ancho_cm', 120),
  entry('ventanas-norte', 'alto_cm', 150),
];

const source = { documentId: 'a201', revisionId: 'r1', authorId: 'fernanda' };

describe('buildProposalDraft', () => {
  it('arma un solo borrador por revisión, con un hunk por cambio y el antes y después de cada elemento', () => {
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
    const draft = buildProposalDraft(outcomes, baseline, source);
    expect(draft).toMatchObject({
      documentId: 'a201',
      sourceRevisionId: 'r1',
      authorId: 'fernanda',
      before: {
        'losa-n3': { espesor_cm: 15, largo_m: 8 },
        'ventanas-norte': { ancho_cm: 120, alto_cm: 150 },
      },
      after: {
        'losa-n3': { espesor_cm: 20, largo_m: 8 },
        'ventanas-norte': { ancho_cm: 150, alto_cm: 150 },
      },
    });
    expect(draft?.changes).toEqual([
      {
        subject: 'losa-n3',
        attribute: 'espesor_cm',
        unit: null,
        before: 15,
        after: 20,
        claimId: 'c1',
        locator: 'loc-c1',
      },
      {
        subject: 'ventanas-norte',
        attribute: 'ancho_cm',
        unit: null,
        before: 120,
        after: 150,
        claimId: 'c2',
        locator: 'loc-c2',
      },
    ]);
    expect(draft?.context).toEqual([
      {
        subject: 'ventanas-norte',
        attribute: 'alto_cm',
        value: 150,
        unit: null,
        locator: 'loc-c3',
      },
    ]);
  });

  it('los hechos que usa un documento no son hunks ni contexto', () => {
    const outcomes = classifyClaims({
      kind: 'presupuesto',
      claims: [
        claim('c1', 'r1', 'losa-n3', 'espesor_cm', 20, 'usa'),
        claim('c2', 'r1', 'ventanas-norte', 'ancho_cm', 120, 'usa'),
      ],
      baseline,
      proposals: [],
      discrepancies: [],
    });
    expect(buildProposalDraft(outcomes, baseline, source)).toBeNull();
  });

  it('no abre borrador si nada cambia', () => {
    const outcomes = classifyClaims({
      kind: 'plano',
      claims: [claim('c1', 'r1', 'losa-n3', 'espesor_cm', 15)],
      baseline,
      proposals: [],
      discrepancies: [],
    });
    expect(buildProposalDraft(outcomes, baseline, source)).toBeNull();
  });

  it('un valor de otro documento que ya está en un PR abierto corrobora y queda como contexto', () => {
    const open = proposal('p1', {
      documentId: 'e102',
      changes: [hunk('losa-n3', 'espesor_cm', 15, 20)],
    });
    const outcomes = classifyClaims({
      kind: 'eett',
      documentId: 'eett03',
      claims: [claim('c1', 'r1', 'losa-n3', 'espesor_cm', 20)],
      baseline,
      proposals: [open],
      discrepancies: [],
    });
    expect(outcomes[0]?.kind).toBe('corroborates');
    expect(buildProposalDraft(outcomes, baseline, source)).toBeNull();
  });

  it('una revisión nueva del mismo documento vuelve a proponer lo que ya traía el PR abierto', () => {
    const open = proposal('p1', {
      documentId: 'a201',
      changes: [hunk('ventanas-norte', 'ancho_cm', 120, 150)],
    });
    const outcomes = classifyClaims({
      kind: 'plano',
      documentId: 'a201',
      claims: [
        claim('c1', 'r1', 'ventanas-norte', 'ancho_cm', 150),
        claim('c2', 'r1', 'shaft-s1', 'posicion_m', 8.5),
      ],
      baseline: [...baseline, entry('shaft-s1', 'posicion_m', 6)],
      proposals: [open],
      discrepancies: [],
    });
    expect(outcomes.map((outcome) => outcome.kind)).toEqual([
      'change',
      'change',
    ]);
    expect(
      buildProposalDraft(
        outcomes,
        [...baseline, entry('shaft-s1', 'posicion_m', 6)],
        source,
      )?.changes.map((change) => `${change.subject}.${change.attribute}`),
    ).toEqual(['ventanas-norte.ancho_cm', 'shaft-s1.posicion_m']);
  });
});
