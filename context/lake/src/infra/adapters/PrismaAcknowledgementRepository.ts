import type { Prisma, PrismaClient } from '@team27/data-main';

import type { AcknowledgementRepository } from '../../application/ports/AcknowledgementRepository.ts';
import type {
  Acknowledgement,
  AcknowledgementDraft,
} from '../../domain/Acknowledgement.ts';

type AcknowledgementRow = Prisma.AcknowledgementGetPayload<object>;

const toAcknowledgement = (row: AcknowledgementRow): Acknowledgement => ({
  id: row.id,
  documentId: row.documentId,
  revisionId: row.revisionId,
  signature: row.signature,
  ownerId: row.ownerId,
  note: row.note,
  at: row.at,
});

export class PrismaAcknowledgementRepository implements AcknowledgementRepository {
  private readonly prisma: PrismaClient;
  private readonly projectId: string;

  constructor(prisma: PrismaClient, projectId: string) {
    this.prisma = prisma;
    this.projectId = projectId;
  }

  async create(draft: AcknowledgementDraft): Promise<Acknowledgement> {
    const row = await this.prisma.acknowledgement.create({
      data: {
        projectId: this.projectId,
        documentId: draft.documentId,
        revisionId: draft.revisionId,
        signature: draft.signature,
        ownerId: draft.ownerId,
        note: draft.note,
      },
    });
    return toAcknowledgement(row);
  }

  async list(): Promise<Acknowledgement[]> {
    const rows = await this.prisma.acknowledgement.findMany({
      where: { projectId: this.projectId },
      orderBy: { at: 'asc' },
    });
    return rows.map(toAcknowledgement);
  }

  async clear(): Promise<void> {
    await this.prisma.acknowledgement.deleteMany({
      where: { projectId: this.projectId },
    });
  }
}
