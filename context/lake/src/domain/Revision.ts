import type { DocumentKind } from './DocumentKind.ts';

export interface RevisionDraft {
  readonly documentId: string;
  readonly documentName: string;
  readonly label: string;
  readonly kind: DocumentKind;
  readonly spaceId: string;
  readonly authorId: string;
  readonly contentHash: string;
  readonly sourcePointer: string;
}

export interface Revision extends RevisionDraft {
  readonly id: string;
  readonly ingestOrder: number;
  readonly ingestedAt: Date;
}

export const latestPerDocument = (
  revisions: readonly Revision[],
): Revision[] => {
  const latest = new Map<string, Revision>();
  for (const revision of revisions) {
    const current = latest.get(revision.documentId);
    if (!current || revision.ingestOrder > current.ingestOrder) {
      latest.set(revision.documentId, revision);
    }
  }
  return [...latest.values()].sort((a, b) => a.ingestOrder - b.ingestOrder);
};
