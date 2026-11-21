import { Prisma, type PrismaClient } from '@team27/data-main';

import type { SourceLinkRepository } from '../../application/ports/index.ts';
import type {
  Provider,
  SourceError,
  SourceLink,
  SourceLinkDraft,
  SourceRead,
} from '../../domain/Connection.ts';
import type { IgnoredCell } from '../../domain/readBudgetSheet.ts';

type SourceRow = Prisma.IntegrationSourceGetPayload<object>;

interface StoredRead {
  readonly at: string;
  readonly hash: string;
  readonly epoch: number;
  readonly label: string;
  readonly ignored: readonly IgnoredCell[];
}

interface StoredError {
  readonly at: string;
  readonly message: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readOf = (value: Prisma.JsonValue | null): SourceRead | null => {
  if (!isObject(value)) return null;
  const stored = value as unknown as StoredRead;
  return {
    at: new Date(stored.at),
    hash: stored.hash,
    epoch: stored.epoch,
    label: stored.label,
    ignored: stored.ignored ?? [],
  };
};

const errorOf = (value: Prisma.JsonValue | null): SourceError | null => {
  if (!isObject(value)) return null;
  const stored = value as unknown as StoredError;
  return { at: new Date(stored.at), message: stored.message };
};

const toSource = (row: SourceRow): SourceLink => ({
  id: row.id,
  connectionId: row.connectionId,
  provider: row.provider as Provider,
  externalId: row.externalId,
  documentId: row.documentId,
  title: row.title,
  pointer: row.pointer,
  checkedAt: row.checkedAt,
  lastRead: readOf(row.lastRead),
  lastError: errorOf(row.lastError),
  createdAt: row.createdAt,
});

const storedRead = (read: SourceRead): Prisma.InputJsonValue => ({
  at: read.at.toISOString(),
  hash: read.hash,
  epoch: read.epoch,
  label: read.label,
  ignored: read.ignored.map((cell) => ({
    locator: cell.locator,
    reason: cell.reason,
  })),
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

  async findByDocument(documentId: string): Promise<SourceLink | null> {
    const row = await this.prisma.integrationSource.findUnique({
      where: { documentId },
    });
    return row === null ? null : toSource(row);
  }

  async create(draft: SourceLinkDraft): Promise<SourceLink> {
    const row = await this.prisma.integrationSource.create({
      data: {
        connectionId: draft.connectionId,
        provider: draft.provider,
        externalId: draft.externalId,
        documentId: draft.documentId,
        title: draft.title,
        pointer: draft.pointer,
      },
    });
    return toSource(row);
  }

  async recordCheck(id: string, at: Date, title: string): Promise<SourceLink> {
    const row = await this.prisma.integrationSource.update({
      where: { id },
      data: { checkedAt: at, title, lastError: Prisma.DbNull },
    });
    return toSource(row);
  }

  async recordRead(
    id: string,
    read: SourceRead,
    title: string,
  ): Promise<SourceLink> {
    const row = await this.prisma.integrationSource.update({
      where: { id },
      data: {
        checkedAt: read.at,
        title,
        lastRead: storedRead(read),
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
