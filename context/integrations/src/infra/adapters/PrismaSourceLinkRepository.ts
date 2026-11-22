import { Prisma, type PrismaClient } from '@team27/data-main';

import type { SourceLinkRepository } from '../../application/ports/index.ts';
import type {
  Provider,
  SourceCheck,
  SourceError,
  SourceLink,
  SourceLinkDraft,
} from '../../domain/Connection.ts';

type SourceRow = Prisma.IntegrationSourceGetPayload<object>;

interface StoredError {
  readonly at: string;
  readonly message: string;
}

const errorOf = (value: Prisma.JsonValue | null): SourceError | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const stored = value as unknown as StoredError;
  return { at: new Date(stored.at), message: stored.message };
};

const toSource = (row: SourceRow): SourceLink => ({
  id: row.id,
  connectionId: row.connectionId,
  provider: row.provider as Provider,
  externalId: row.externalId,
  title: row.title,
  pointer: row.pointer,
  contentHash: row.contentHash,
  checkedAt: row.checkedAt,
  changedAt: row.changedAt,
  lastError: errorOf(row.lastError),
  createdAt: row.createdAt,
});

export class PrismaSourceLinkRepository implements SourceLinkRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async list(): Promise<SourceLink[]> {
    const rows = await this.prisma.integrationSource.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toSource);
  }

  async find(id: string): Promise<SourceLink | null> {
    const row = await this.prisma.integrationSource.findUnique({
      where: { id },
    });
    return row === null ? null : toSource(row);
  }

  async findByExternalId(externalId: string): Promise<SourceLink | null> {
    const row = await this.prisma.integrationSource.findUnique({
      where: { externalId },
    });
    return row === null ? null : toSource(row);
  }

  async create(draft: SourceLinkDraft): Promise<SourceLink> {
    const row = await this.prisma.integrationSource.create({
      data: {
        connectionId: draft.connectionId,
        provider: draft.provider,
        externalId: draft.externalId,
        title: draft.title,
        pointer: draft.pointer,
        contentHash: draft.contentHash,
        checkedAt: draft.checkedAt,
      },
    });
    return toSource(row);
  }

  async recordCheck(id: string, check: SourceCheck): Promise<SourceLink> {
    const row = await this.prisma.integrationSource.update({
      where: { id },
      data: {
        title: check.title,
        contentHash: check.contentHash,
        checkedAt: check.at,
        ...(check.changed ? { changedAt: check.at } : {}),
        lastError: Prisma.DbNull,
      },
    });
    return toSource(row);
  }

  async recordError(id: string, error: SourceError): Promise<SourceLink> {
    const row = await this.prisma.integrationSource.update({
      where: { id },
      data: {
        lastError: { at: error.at.toISOString(), message: error.message },
      },
    });
    return toSource(row);
  }

  async remove(id: string): Promise<boolean> {
    const removed = await this.prisma.integrationSource.deleteMany({
      where: { id },
    });
    return removed.count > 0;
  }
}
