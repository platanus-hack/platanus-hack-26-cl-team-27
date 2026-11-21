import { classifyClaims } from '../../src/domain/classifyClaims.ts';
import type { Claim } from '../../src/domain/Claim.ts';
import type { DocumentKind } from '../../src/domain/DocumentKind.ts';
import { claim, discrepancy, entry, proposal } from '../factories.ts';

const baseline = [
  entry('losa-n3', 'espesor_cm', 15),
  entry('ventanas-norte', 'ancho_cm', 120),
  entry('proyecto', 'entrega_dias', 108),
];

const classify = (
  kind: DocumentKind,
  claims: Claim[],
  extra: Partial<Parameters<typeof classifyClaims>[0]> = {},
) =>
  classifyClaims({
    kind,
    claims,
    baseline,
    proposals: [],
    discrepancies: [],
    ...extra,
  });

describe('classifyClaims', () => {
  it.each([
    ['same', 'plano', 'losa-n3', 'espesor_cm', 15],
    ['change', 'plano', 'losa-n3', 'espesor_cm', 20],
    ['change', 'eett', 'losa-n3', 'espesor_cm', 25],
    ['discrepancy', 'mensaje', 'ventanas-norte', 'ancho_cm', 150],
    ['discrepancy', 'libro_obra', 'losa-n3', 'espesor_cm', 18],
    ['discrepancy', 'cotizacion', 'ventanas-norte', 'ancho_cm', 150],
    ['change', 'carta_gantt', 'proyecto', 'entrega_dias', 109],
    ['discrepancy', 'plano', 'proyecto', 'entrega_dias', 109],
    ['unknown', 'plano', 'losa-n3', 'alto_cm', 20],
  ] as const)(
    'una afirmación es %s (%s, %s.%s = %s)',
    (expected, kind, subject, attribute, value) => {
      const [outcome] = classify(kind, [
        claim('c1', 'r1', subject, attribute, value),
      ]);
      expect(outcome?.kind).toBe(expected);
    },
  );

  it('una cotización que afirma diseño abre discrepancia con el valor vigente', () => {
    const [outcome] = classify('cotizacion', [
      claim('c1', 'r1', 'ventanas-norte', 'ancho_cm', 150),
    ]);
    expect(outcome).toMatchObject({ kind: 'discrepancy', baselineValue: 120 });
  });

  it('corrobora la propuesta abierta que trae el mismo valor, venga de donde venga', () => {
    const open = proposal('p1');
    for (const kind of ['plano', 'mensaje'] as const) {
      const [outcome] = classify(
        kind,
        [claim('c1', 'r1', 'losa-n3', 'espesor_cm', 20)],
        { proposals: [open] },
      );
      expect(outcome).toMatchObject({ kind: 'corroborates', proposalId: 'p1' });
    }
  });

  it('no corrobora una propuesta retirada', () => {
    const [outcome] = classify(
      'plano',
      [claim('c1', 'r1', 'losa-n3', 'espesor_cm', 20)],
      { proposals: [proposal('p1', { status: 'withdrawn' })] },
    );
    expect(outcome?.kind).toBe('change');
  });

  it('un hecho usa igual a lo vigente está al día', () => {
    const [outcome] = classify('presupuesto', [
      claim('c1', 'r1', 'losa-n3', 'espesor_cm', 15, 'usa'),
    ]);
    expect(outcome?.kind).toBe('uses_current');
  });

  it('un hecho usa distinto de lo vigente deja el documento desfasado', () => {
    const [outcome] = classify('presupuesto', [
      claim('c1', 'r1', 'ventanas-norte', 'ancho_cm', 100, 'usa'),
    ]);
    expect(outcome).toMatchObject({ kind: 'stale', baselineValue: 120 });
  });

  it('un hecho usa que coincide con una propuesta abierta no es desfase', () => {
    const [outcome] = classify(
      'presupuesto',
      [claim('c1', 'r1', 'losa-n3', 'espesor_cm', 20, 'usa')],
      { proposals: [proposal('p1')] },
    );
    expect(outcome).toMatchObject({ kind: 'uses_proposed', proposalId: 'p1' });
  });

  it('una revisión con autoridad respalda la discrepancia abierta con su mismo valor', () => {
    const open = discrepancy('d1');
    const [outcome] = classify(
      'plano',
      [claim('c1', 'r1', 'ventanas-norte', 'ancho_cm', 150)],
      { discrepancies: [open] },
    );
    expect(outcome).toMatchObject({
      kind: 'change',
      backsDiscrepancyIds: ['d1'],
    });
  });

  it('un mensaje con el mismo valor no respalda la discrepancia', () => {
    const [outcome] = classify(
      'mensaje',
      [claim('c1', 'r1', 'ventanas-norte', 'ancho_cm', 150)],
      { discrepancies: [discrepancy('d1')] },
    );
    expect(outcome?.backsDiscrepancyIds).toEqual([]);
  });

  it('una discrepancia con otro valor no se respalda', () => {
    const [outcome] = classify(
      'plano',
      [claim('c1', 'r1', 'ventanas-norte', 'ancho_cm', 160)],
      { discrepancies: [discrepancy('d1')] },
    );
    expect(outcome?.backsDiscrepancyIds).toEqual([]);
  });
});
