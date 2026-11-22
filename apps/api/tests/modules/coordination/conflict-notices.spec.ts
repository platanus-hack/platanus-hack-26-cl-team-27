import type { Overlap, Proposal, Revision } from '@team27/context-lake';
import type { Notification } from '@team27/context-notification';

import {
  conflictPreviews,
  conflictRecipients,
  conflictToNotify,
} from '../../../src/modules/coordination/notices.ts';
import { project } from '../../project.ts';

const at = new Date('2026-11-22T12:00:00Z');

const proposalOf = (
  id: string,
  changeId: string,
  authorId: string,
  reviewerIds: readonly string[],
): Proposal => ({
  id,
  changeId,
  changeIds: [changeId],
  documentId: 'a201',
  sourceRevisionId: 'r1',
  authorId,
  changes: [],
  context: [],
  status: 'open',
  reviews: reviewerIds.map((reviewerId) => ({
    reviewerId,
    decision: null,
    note: null,
    at: null,
  })),
  filtered: [],
  openedAt: at,
  resolvedAt: null,
  supersededById: null,
});

const overlap: Overlap = {
  id: 'o1',
  proposalId: 'p1',
  otherProposalId: null,
  revisionId: 'r1',
  chunkLocator: 'cuadro de shafts',
  kind: 'misma-area',
  area: null,
  relation: null,
  subjectId: 'shaft-s1',
  otherSubjectId: 'colector-b2',
  otherBacking: {
    documentId: 'is301',
    label: 'rev A',
    ownerId: 'javier-munoz',
  },
  validators: ['fernanda-lagos', 'javier-munoz'],
  status: 'abierto',
  votes: [],
  resolution: null,
  createdAt: at,
  resolvedAt: null,
};

const revision: Revision = {
  id: 'r1',
  documentId: 'a201',
  documentName: 'A-201',
  label: 'rev D',
  kind: 'plano',
  spaceId: 'drive-proyecto',
  authorId: 'fernanda-lagos',
  contentHash: 'h',
  sourcePointer: 'p',
  ingestOrder: 1,
  ingestedAt: at,
};

const shaft = proposalOf('p1', 'c1', 'fernanda-lagos', [
  'paula-rojas',
  'javier-munoz',
  'camila-vera',
]);

describe('a quién le llega el aviso de conflicto', () => {
  it('a los dos autores y a los afectados, una vez por persona; solo los dueños de los dos lados votan', () => {
    expect(conflictRecipients(overlap, [shaft])).toEqual([
      {
        stakeholderId: 'fernanda-lagos',
        changeId: 'c1',
        part: 'author',
        votes: true,
      },
      {
        stakeholderId: 'javier-munoz',
        changeId: 'c1',
        part: 'author',
        votes: true,
      },
      {
        stakeholderId: 'paula-rojas',
        changeId: 'c1',
        part: 'affected',
        votes: false,
      },
      {
        stakeholderId: 'camila-vera',
        changeId: 'c1',
        part: 'affected',
        votes: false,
      },
    ]);
  });

  it('entre dos propuestas, cada persona recibe el enlace al cambio de su lado', () => {
    const colector = proposalOf('p2', 'c2', 'javier-munoz', ['daniela-soto']);
    const recipients = conflictRecipients(
      { ...overlap, otherProposalId: 'p2' },
      [shaft, colector],
    );

    expect(
      recipients.find((item) => item.stakeholderId === 'daniela-soto'),
    ).toEqual({
      stakeholderId: 'daniela-soto',
      changeId: 'c2',
      part: 'affected',
      votes: false,
    });
    expect(
      recipients.find((item) => item.stakeholderId === 'javier-munoz')
        ?.changeId,
    ).toBe('c2');
  });

  it('sin un cambio al que apuntar no hay aviso', () => {
    expect(conflictRecipients(overlap, [])).toEqual([]);
    expect(
      conflictToNotify({
        project,
        overlap,
        proposals: [],
        revisions: [revision],
        impacts: new Map(),
      }),
    ).toBeNull();
  });
});

describe('el contenido del aviso de conflicto', () => {
  const conflict = conflictToNotify({
    project,
    overlap,
    proposals: [shaft],
    revisions: [revision],
    impacts: new Map(),
  });

  it('nombra los dos elementos con su documento y trae la pregunta de sí o no', () => {
    const first = project.subjectName('shaft-s1');
    const second = project.subjectName('colector-b2');

    expect(conflict?.conflict).toMatchObject({
      overlapId: 'o1',
      first,
      firstSource: 'A-201 rev D',
      second,
      area: null,
      question: `¿Se topan ${first} y ${second}?`,
      combined: null,
    });
    expect(conflict?.conflict.secondSource).toContain('rev A');
  });

  it('se previsualiza en el canal de cada persona', () => {
    const stored: Notification = {
      id: 'n1',
      changeId: 'c1',
      stakeholderId: 'javier-munoz',
      channel: 'whatsapp',
      title: 'x',
      findings: [],
      link: '/proyectos/los-aromos/cambios/c1',
      context: {
        kind: 'conflict',
        role: 'Instalaciones sanitarias',
        recipientName: 'Javier Muñoz',
        impact: null,
        clashes: [],
        conflict: conflict
          ? { ...conflict.conflict, part: 'author', votes: true }
          : undefined,
      },
      sentAt: at,
      response: null,
    };
    const [preview] = conflictPreviews({
      project,
      notifications: [stored],
      baseUrl: 'https://vigente.example',
    });

    expect(preview).toMatchObject({
      kind: 'conflict',
      channel: 'whatsapp',
      overlapId: 'o1',
      part: 'author',
      votes: true,
    });
    expect(preview?.text).toContain('Responde si se tocan o no se tocan:');
    expect(preview?.text).toContain(
      'https://vigente.example/proyectos/los-aromos/cambios/c1',
    );
  });
});
