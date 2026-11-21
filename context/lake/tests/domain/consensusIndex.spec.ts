import { computeStaleness } from '../../src/domain/computeStaleness.ts';
import { consensusIndex } from '../../src/domain/consensusIndex.ts';
import { claim, discrepancy, entry, proposal, revision } from '../factories.ts';

const revisions = [
  revision('a', { kind: 'eett', ingestOrder: 1 }),
  revision('b', { kind: 'presupuesto', ingestOrder: 2 }),
  revision('wa', { kind: 'mensaje', ingestOrder: 3 }),
  revision('d', { kind: 'plano', ingestOrder: 4 }),
];

const stale = computeStaleness({
  revisions,
  claims: [claim('c1', 'b', 'losa-n3', 'espesor_cm', 15, 'usa')],
  baseline: [entry('losa-n3', 'espesor_cm', 20)],
  proposals: [],
  acknowledgements: [],
});

describe('consensusIndex', () => {
  it('cuenta documentos al día sobre totales', () => {
    const index = consensusIndex({
      revisions,
      stale,
      discrepancies: [],
      proposals: [],
      overlaps: [],
    });
    expect(index).toMatchObject({
      upToDate: 3,
      total: 4,
      staleDocuments: 1,
      sealed: false,
    });
  });

  it('una discrepancia abierta resta al documento que discrepa', () => {
    const index = consensusIndex({
      revisions,
      stale: [],
      discrepancies: [discrepancy('d1', { documentId: 'wa' })],
      proposals: [],
      overlaps: [],
    });
    expect(index).toMatchObject({
      upToDate: 3,
      openDiscrepancies: 1,
      sealed: false,
    });
  });

  it('una propuesta abierta impide el sello aunque todo esté al día', () => {
    const index = consensusIndex({
      revisions,
      stale: [],
      discrepancies: [],
      proposals: [proposal('p1')],
      overlaps: [],
    });
    expect(index).toMatchObject({
      upToDate: 4,
      openProposals: 1,
      sealed: false,
    });
  });

  it('un desfase confirmado sin cambio cuenta al día y permite el sello', () => {
    const acknowledged = stale.map((document) => ({
      ...document,
      acknowledgement: {
        id: 'a1',
        documentId: document.documentId,
        revisionId: document.revisionId,
        signature: document.signature,
        ownerId: 'daniela',
        note: 'n',
        at: new Date(),
      },
    }));
    const index = consensusIndex({
      revisions,
      stale: acknowledged,
      discrepancies: [discrepancy('d1', { status: 'backed' })],
      proposals: [proposal('p1', { status: 'merged' })],
      overlaps: [],
    });
    expect(index).toMatchObject({
      upToDate: 4,
      total: 4,
      acknowledgedDocuments: 1,
      sealed: true,
    });
  });
});
