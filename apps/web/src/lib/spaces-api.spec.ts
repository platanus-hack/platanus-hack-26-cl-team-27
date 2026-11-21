import { describe, expect, it } from 'vitest';

import {
  findDocument,
  latestRevision,
  pendingDocuments,
  revisionCount,
  revisionsNewestFirst,
  type DocumentView,
  type RevisionView,
  type SpaceView,
} from './spaces-api';

const revision = (
  id: string,
  capturedAt: string,
  current = false,
): RevisionView => ({
  id,
  label: id,
  title: 'Presupuesto itemizado',
  pointer: `Costos/${id}.csv`,
  author: { id: 'daniela-soto', name: 'Daniela Soto' },
  capturedAt,
  current,
  claims: [],
});

const document = (
  id: string,
  state: DocumentView['state'],
  revisions: RevisionView[],
): DocumentView => ({
  id,
  title: id,
  kind: 'presupuesto',
  state,
  ownerId: 'daniela-soto',
  ownerName: 'Daniela Soto',
  staleFacts: [],
  acknowledgedNote: null,
  revisions,
});

const spaces: SpaceView[] = [
  {
    id: 'costos',
    name: 'Carpeta de costos',
    kind: 'sharepoint',
    ownerId: 'daniela-soto',
    ownerName: 'Daniela Soto',
    documents: [
      document('presupuesto', 'stale', [
        revision('v2', '2026-11-21T09:00:00Z'),
        revision('v3', '2026-11-21T10:00:00Z', true),
      ]),
      document('gantt', 'current', [
        revision('v4', '2026-11-21T09:00:00Z', true),
      ]),
    ],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Obra Los Aromos',
    kind: 'whatsapp',
    ownerId: 'marcos-fuentes',
    ownerName: 'Marcos Fuentes',
    documents: [
      document('mensajes', 'discrepancy', [
        revision('m2', '2026-11-21T10:30:00Z', true),
      ]),
    ],
  },
];

describe('pendingDocuments', () => {
  it('lista los desfasados y los con discrepancia, con su espacio', () => {
    expect(
      pendingDocuments(spaces).map((item) => [
        item.id,
        item.state,
        item.spaceName,
      ]),
    ).toEqual([
      ['presupuesto', 'stale', 'Carpeta de costos'],
      ['mensajes', 'discrepancy', 'WhatsApp Obra Los Aromos'],
    ]);
  });
});

describe('revisiones', () => {
  const presupuesto = spaces[0]?.documents[0] as DocumentView;

  it('ordena de la más nueva a la más vieja y encuentra la vigente', () => {
    expect(revisionsNewestFirst(presupuesto).map((item) => item.id)).toEqual([
      'v3',
      'v2',
    ]);
    expect(latestRevision(presupuesto)?.id).toBe('v3');
  });

  it('cuenta las revisiones de un espacio', () => {
    expect(revisionCount(spaces[0] as SpaceView)).toBe(3);
  });
});

describe('findDocument', () => {
  it('encuentra un documento por id o por una de sus revisiones', () => {
    expect(findDocument(spaces, { documentId: 'gantt' })?.spaceId).toBe(
      'costos',
    );
    expect(findDocument(spaces, { revisionId: 'm2' })?.id).toBe('mensajes');
    expect(findDocument(spaces, { revisionId: 'nada' })).toBeNull();
    expect(findDocument(spaces, {})).toBeNull();
  });
});
