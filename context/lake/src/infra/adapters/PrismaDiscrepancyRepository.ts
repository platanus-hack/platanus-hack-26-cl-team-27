import type { Prisma, PrismaClient } from '@team27/data-main';

import type { DiscrepancyRepository } from '../../application/ports/DiscrepancyRepository.ts';
import type { ClaimValue } from '../../domain/Claim.ts';
import type {
  Discrepancy,
  DiscrepancyDraft,
  DiscrepancyResolution,
  DiscrepancyStatus,
} from '../../domain/Discrepancy.ts';
import { toJson } from './json.ts';

type DiscrepancyRow = Prisma.DiscrepancyGetPayload<object>;

const toDiscrepancy = (row: DiscrepancyRow): Discrepancy => ({
  id: row.id,
  subject: row.subject,
  attribute: row.attribute,
  value: row.value as ClaimValue,
  baselineValue: row.baselineValue as ClaimValue,
  unit: row.unit,
  documentId: row.documentId,
  revisionId: row.revisionId,
  claimId: row.claimId,
  ownerId: row.ownerId,
  status: row.status as DiscrepancyStatus,
  backedByRevisionId: row.backedByRevisionId,
  note: row.note,
  createdAt: row.createdAt,
  resolvedAt: row.resolvedAt,
});

export class PrismaDiscrepancyRepository implements DiscrepancyRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(draft: DiscrepancyDraft): Promise<Discrepancy> {
    const row = await this.prisma.discrepancy.create({
      data: {
        subject: draft.subject,
        attribute: draft.attribute,
        value: toJson(draft.value),
        baselineValue: toJson(draft.baselineValue),
        unit: draft.unit,
        documentId: draft.documentId,
        revisionId: draft.revisionId,
        claimId: draft.claimId,
        ownerId: draft.ownerId,
      },
    });
    return toDiscrepancy(row);
  }

  async resolve(
    id: string,
    resolution: DiscrepancyResolution,
  ): Promise<Discrepancy> {
    const row = await this.prisma.discrepancy.update({
      where: { id },
      data: {
        status: resolution.status,
        backedByRevisionId: resolution.backedByRevisionId,
        note: resolution.note,
        resolvedAt: resolution.resolvedAt,
      },
    });
    return toDiscrepancy(row);
  }

  async findById(id: string): Promise<Discrepancy | null> {
    const row = await this.prisma.discrepancy.findUnique({ where: { id } });
    return row ? toDiscrepancy(row) : null;
  }

  async list(): Promise<Discrepancy[]> {
    const rows = await this.prisma.discrepancy.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDiscrepancy);
  }

  async listOpen(): Promise<Discrepancy[]> {
    const rows = await this.prisma.discrepancy.findMany({
      where: { status: 'open' },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDiscrepancy);
  }

  async clear(): Promise<void> {
    await this.prisma.discrepancy.deleteMany();
  }
}
