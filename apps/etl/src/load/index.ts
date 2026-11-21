import { createHash } from 'node:crypto';

import type { Revision } from '../types.ts';
import type { Api, IngestResponse } from './api.ts';

export * from './api.ts';

export const actionIdOf = (parts: readonly string[]): string =>
  createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 32);

export const revisionActionId = (
  revision: Pick<Revision, 'documentId' | 'label'>,
): string => actionIdOf([revision.documentId, revision.label]);

export const revisionBody = (revision: Revision) => ({
  documentId: revision.documentId,
  label: revision.label,
  spaceId: revision.spaceId,
  pointer: revision.pointer,
  contentHash: revision.contentHash,
  claims: revision.claims,
});

export const ingestRevision = (
  api: Api,
  revision: Revision,
): Promise<IngestResponse> =>
  api.request<IngestResponse>('POST', '/revisions', {
    actAs: revision.authorId,
    actionId: revisionActionId(revision),
    body: revisionBody(revision),
  });

export const seedLake = (
  api: Api,
  revisions: readonly Revision[],
): Promise<unknown> =>
  api.request('POST', '/lake/seed', {
    body: {
      revisions: revisions.map((revision) => ({
        ...revisionBody(revision),
        authorId: revision.authorId,
      })),
    },
  });
