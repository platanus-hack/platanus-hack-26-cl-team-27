import { buildProvenance } from '../../src/domain/buildProvenance.ts';
import {
  at,
  claim,
  discrepancy,
  entry,
  proposal,
  review,
  revision,
} from '../factories.ts';

describe('buildProvenance', () => {
  const revisions = [
    revision('r-base', { documentId: 'e102', label: 'rev B', ingestOrder: 1 }),
    revision('r-new', { documentId: 'e102', label: 'rev C', ingestOrder: 2 }),
    revision('r-eett', { documentId: 'eett', kind: 'eett', ingestOrder: 3 }),
  ];
  const claims = [
    claim('c-old', 'r-base', 'losa-n3', 'espesor_cm', 15),
    claim('c-new', 'r-new', 'losa-n3', 'espesor_cm', 20),
    claim('c-eett', 'r-eett', 'losa-n3', 'espesor_cm', 20),
    claim('c-other', 'r-eett', 'losa-n3', 'espesor_cm', 99, 'usa'),
  ];
  const merged = proposal('p1', {
    status: 'merged',
    reviews: [review('paula', 'approve'), review('javier', 'approve')],
  });
  const current = entry('losa-n3', 'espesor_cm', 20, {
    claimId: 'c-new',
    revisionId: 'r-new',
    proposalId: 'p1',
    version: 2,
    since: at(10),
  });

  it('arma la cadena de un valor: hecho, revisión, propuesta, aprobaciones, fuentes y anteriores', () => {
    const provenance = buildProvenance({
      entry: current,
      history: [
        {
          subject: 'losa-n3',
          attribute: 'espesor_cm',
          value: 15,
          unit: null,
          claimId: 'c-old',
          revisionId: 'r-base',
          proposalId: null,
          since: at(0),
          until: at(10),
        },
      ],
      revisions,
      claims,
      proposals: [merged],
      discrepancies: [],
    });
    expect(provenance).toMatchObject({
      value: 20,
      version: 2,
      status: 'confirmed',
      claim: { id: 'c-new' },
      revision: { label: 'rev C' },
      proposal: { id: 'p1' },
    });
    expect(provenance.approvals.map((r) => r.reviewerId)).toEqual([
      'paula',
      'javier',
    ]);
    expect(provenance.sources.map((s) => s.claim.id)).toEqual([
      'c-new',
      'c-eett',
    ]);
    expect(provenance.previous).toEqual([
      expect.objectContaining({
        value: 15,
        claim: expect.objectContaining({ id: 'c-old' }),
        revision: expect.objectContaining({ label: 'rev B' }),
      }),
    ]);
  });

  it('enlaza las discrepancias respaldadas con su revisión', () => {
    const provenance = buildProvenance({
      entry: entry('ventanas-norte', 'ancho_cm', 150, { revisionId: 'r-new' }),
      history: [],
      revisions,
      claims: [],
      proposals: [],
      discrepancies: [
        discrepancy('d1', { status: 'backed', revisionId: 'r-eett' }),
        discrepancy('d2', { status: 'open' }),
      ],
    });
    expect(provenance.backedDiscrepancies).toHaveLength(1);
    expect(provenance.backedDiscrepancies[0]?.revision?.id).toBe('r-eett');
  });

  it('el estado refleja propuestas abiertas y en disputa', () => {
    const base = {
      entry: current,
      history: [],
      revisions,
      claims,
      discrepancies: [],
    };
    expect(
      buildProvenance({ ...base, proposals: [proposal('p2')] }).status,
    ).toBe('proposed');
    expect(
      buildProvenance({
        ...base,
        proposals: [proposal('p2', { status: 'disputed' })],
      }).status,
    ).toBe('disputed');
  });
});
