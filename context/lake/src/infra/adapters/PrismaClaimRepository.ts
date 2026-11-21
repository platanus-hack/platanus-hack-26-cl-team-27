import type { Prisma, PrismaClient } from '@team27/data-main';

import type {
  ClaimInsert,
  ClaimRepository,
} from '../../application/ports/ClaimRepository.ts';
import type { Claim, ClaimRole, ClaimValue } from '../../domain/Claim.ts';
import { toJson } from './json.ts';

type ClaimRow = Prisma.ClaimGetPayload<object>;

const toClaim = (row: ClaimRow): Claim => ({
  id: row.id,
  revisionId: row.revisionId,
  subject: row.subject,
  attribute: row.attribute,
  value: row.value as ClaimValue,
  unit: row.unit,
  role: row.role as ClaimRole,
  locator: row.locator,
  chunkId: row.chunkId,
  confidence: row.confidence,
});

export class PrismaClaimRepository implements ClaimRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async saveMany(
    revisionId: string,
    inserts: readonly ClaimInsert[],
  ): Promise<Claim[]> {
    const rows = await this.prisma.$transaction(
      inserts.map((draft) =>
        this.prisma.claim.create({
          data: {
            revisionId,
            subject: draft.subject,
            attribute: draft.attribute,
            value: toJson(draft.value),
            unit: draft.unit,
            role: draft.role,
            locator: draft.locator,
            chunkId: draft.chunkId,
            confidence: draft.confidence ?? null,
          },
        }),
      ),
    );
    return rows.map(toClaim);
  }

  async list(): Promise<Claim[]> {
    const rows = await this.prisma.claim.findMany({
      orderBy: [
        { revision: { ingestOrder: 'asc' } },
        { subject: 'asc' },
        { attribute: 'asc' },
      ],
    });
    return rows.map(toClaim);
  }

  async listFor(subject: string, attribute: string): Promise<Claim[]> {
    const rows = await this.prisma.claim.findMany({
      where: { subject, attribute },
      orderBy: { revision: { ingestOrder: 'asc' } },
    });
    return rows.map(toClaim);
  }

  async clear(): Promise<void> {
    await this.prisma.claim.deleteMany();
  }
}
