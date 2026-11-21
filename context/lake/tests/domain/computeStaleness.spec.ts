import { computeStaleness } from '../../src/domain/computeStaleness.ts';
import { at, claim, entry, hunk, proposal, revision } from '../factories.ts';

const baseline = [
  entry('losa-n3', 'espesor_cm', 20),
  entry('ventanas-norte', 'ancho_cm', 120),
];

const revisions = [
  revision('eett', { kind: 'eett', ingestOrder: 1, authorId: 'paula' }),
  revision('presupuesto', {
    kind: 'presupuesto',
    ingestOrder: 2,
    authorId: 'daniela',
  }),
  revision('wa', { kind: 'mensaje', ingestOrder: 3, authorId: 'marcos' }),
];

const compute = (
  claims: ReturnType<typeof claim>[],
  extra: Partial<Parameters<typeof computeStaleness>[0]> = {},
  revs = revisions,
) =>
  computeStaleness({
    revisions: revs,
    claims,
    baseline,
    proposals: [],
    acknowledgements: [],
    ...extra,
  });

describe('computeStaleness', () => {
  it('un documento que afirma con autoridad un valor viejo queda desfasado, con su dueño', () => {
    const stale = compute([claim('c1', 'eett', 'losa-n3', 'espesor_cm', 15)]);
    expect(stale).toHaveLength(1);
    expect(stale[0]).toMatchObject({
      documentId: 'eett',
      ownerId: 'paula',
      items: [{ usedValue: 15, currentValue: 20, role: 'afirma' }],
    });
  });

  it('un documento que usa un valor viejo queda desfasado aunque no mande', () => {
    const stale = compute([
      claim('c1', 'presupuesto', 'ventanas-norte', 'ancho_cm', 100, 'usa'),
    ]);
    expect(stale.map((d) => d.documentId)).toEqual(['presupuesto']);
  });

  it('un mensaje que difiere no queda desfasado: abre discrepancia', () => {
    expect(
      compute([claim('c1', 'wa', 'ventanas-norte', 'ancho_cm', 150)]),
    ).toEqual([]);
  });

  it('un hecho igual a lo vigente no es desfase', () => {
    expect(compute([claim('c1', 'eett', 'losa-n3', 'espesor_cm', 20)])).toEqual(
      [],
    );
  });

  it('un hecho que pertenece a una propuesta abierta no es desfase', () => {
    const open = proposal('p1', {
      changes: [hunk('ventanas-norte', 'ancho_cm', 120, 150)],
    });
    const claims = [
      claim('c1', 'presupuesto', 'ventanas-norte', 'ancho_cm', 150, 'usa'),
    ];
    expect(compute(claims, { proposals: [open] })).toEqual([]);
    expect(
      compute(claims, { proposals: [{ ...open, status: 'withdrawn' }] }),
    ).toHaveLength(1);
  });

  it('solo cuenta la última revisión de cada documento', () => {
    const claims = [
      claim('old', 'eett', 'losa-n3', 'espesor_cm', 15),
      claim('new', 'eett2', 'losa-n3', 'espesor_cm', 20),
    ];
    const revs = [
      revisions[0]!,
      revision('eett2', {
        documentId: 'eett',
        kind: 'eett',
        label: 'rev B',
        ingestOrder: 5,
      }),
    ];
    expect(compute(claims, {}, revs)).toEqual([]);
  });

  it('confirmar sin cambio deja el desfase visible con su confirmación', () => {
    const claims = [claim('c1', 'eett', 'losa-n3', 'espesor_cm', 15)];
    const [first] = compute(claims);
    const acknowledgement = {
      id: 'a1',
      documentId: 'eett',
      revisionId: 'eett',
      signature: first!.signature,
      ownerId: 'paula',
      note: 'No cambia la EETT',
      at: at(9),
    };
    const [acknowledged] = compute(claims, {
      acknowledgements: [acknowledgement],
    });
    expect(acknowledged?.acknowledgement).toEqual(acknowledgement);
  });

  it('la confirmación pierde vigencia si lo vigente cambia de nuevo', () => {
    const claims = [claim('c1', 'eett', 'losa-n3', 'espesor_cm', 15)];
    const acknowledgement = {
      id: 'a1',
      documentId: 'eett',
      revisionId: 'eett',
      signature: 'otra-firma',
      ownerId: 'paula',
      note: 'n',
      at: at(9),
    };
    expect(
      compute(claims, { acknowledgements: [acknowledgement] })[0]
        ?.acknowledgement,
    ).toBeNull();
  });
});
