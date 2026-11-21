import type { Prisma, PrismaClient } from '@team27/data-main';

import type { RevisionRepository } from '../../application/ports/RevisionRepository.ts';
import type { DocumentKind } from '../../domain/DocumentKind.ts';
import type { Revision, RevisionDraft } from '../../domain/Revision.ts';

type RevisionRow = Prisma.RevisionGetPayload<object>;

export const toRevision = (row: RevisionRow): Revision => ({
  id: row.id,
  documentId: row.documentId,
  documentName: row.documentName,
  label: row.label,
  kind: row.kind as DocumentKind,
  spaceId: row.spaceId,
  authorId: row.authorId,
  contentHash: row.contentHash,
  sourcePointer: row.sourcePointer,
  ingestOrder: row.ingestOrder,
  ingestedAt: row.ingestedAt,
});

export class PrismaRevisionRepository implements RevisionRepository {
  private readonly prisma: PrismaClient;
  private readonly projectId: string;

  constructor(prisma: PrismaClient, projectId: string) {
    this.prisma = prisma;
    this.projectId = projectId;
  }

  async save(draft: RevisionDraft): Promise<Revision> {
    const row = await this.prisma.revision.create({
      data: {
        projectId: this.projectId,
        documentId: draft.documentId,
        documentName: draft.documentName,
        label: draft.label,
        kind: draft.kind,
        spaceId: draft.spaceId,
        authorId: draft.authorId,
        contentHash: draft.contentHash,
        sourcePointer: draft.sourcePointer,
      },
    });
    return toRevision(row);
  }

  async findByKey(documentId: string, label: string): Promise<Revision | null> {
    const row = await this.prisma.revision.findUnique({
      where: {
        projectId_documentId_label: {
          projectId: this.projectId,
          documentId,
          label,
        },
      },
    });
    return row ? toRevision(row) : null;
  }

  async findById(id: string): Promise<Revision | null> {
    const row = await this.prisma.revision.findUnique({
      where: { id, projectId: this.projectId },
    });
    return row ? toRevision(row) : null;
  }

  async list(): Promise<Revision[]> {
    const rows = await this.prisma.revision.findMany({
      where: { projectId: this.projectId },
      orderBy: { ingestOrder: 'asc' },
    });
    return rows.map(toRevision);
  }

  async deleteByDocuments(documentIds: readonly string[]): Promise<void> {
    await this.prisma.revision.deleteMany({
      where: {
        projectId: this.projectId,
        documentId: { in: [...documentIds] },
      },
    });
  }

  async clear(): Promise<void> {
    await this.prisma.revision.deleteMany({
      where: { projectId: this.projectId },
    });
  }
}
