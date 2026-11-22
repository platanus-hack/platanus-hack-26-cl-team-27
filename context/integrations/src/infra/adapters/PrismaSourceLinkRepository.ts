import { Prisma, type PrismaClient } from '@team27/data-main';

import type { SourceLinkRepository } from '../../application/ports/index.ts';
import type {
  Provider,
  SourceCheck,
  SourceError,
  SourceLink,
  SourceLinkDraft,
  SourceRelink,
} from '../../domain/Connection.ts';
import type { Editor, PushChannel } from '../../domain/Push.ts';

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

const editorOf = (value: Prisma.JsonValue | null): Editor | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const stored = value as Record<string, unknown>;
  const text = (key: string): string | null =>
    typeof stored[key] === 'string' ? stored[key] : null;
  return { name: text('name'), email: text('email') };
};

const channelOf = (row: SourceRow): PushChannel | null =>
  row.watchChannelId &&
  row.watchResourceId &&
  row.watchToken &&
  row.watchExpiresAt
    ? {
        id: row.watchChannelId,
        resourceId: row.watchResourceId,
        token: row.watchToken,
        expiresAt: row.watchExpiresAt,
      }
    : null;

const toSource = (row: SourceRow): SourceLink => ({
  id: row.id,
  projectId: row.projectId,
  connectionId: row.connectionId,
  provider: row.provider as Provider,
  externalId: row.externalId,
  title: row.title,
  pointer: row.pointer,
  contentHash: row.contentHash,
  checkedAt: row.checkedAt,
  changedAt: row.changedAt,
  changedBy: editorOf(row.changedBy),
  lastError: errorOf(row.lastError),
  channel: channelOf(row),
  createdAt: row.createdAt,
});

export class PrismaSourceLinkRepository implements SourceLinkRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async list(projectId?: string): Promise<SourceLink[]> {
    const rows = await this.prisma.integrationSource.findMany({
      ...(projectId === undefined ? {} : { where: { projectId } }),
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

  async findInProject(
    projectId: string,
    externalId: string,
  ): Promise<SourceLink | null> {
    const row = await this.prisma.integrationSource.findUnique({
      where: { projectId_externalId: { projectId, externalId } },
    });
    return row === null ? null : toSource(row);
  }

  async relink(id: string, relink: SourceRelink): Promise<SourceLink> {
    const row = await this.prisma.integrationSource.update({
      where: { id },
      data: {
        connectionId: relink.connectionId,
        title: relink.title,
        contentHash: relink.contentHash,
        checkedAt: relink.at,
        lastError: Prisma.DbNull,
      },
    });
    return toSource(row);
  }

  async create(draft: SourceLinkDraft): Promise<SourceLink> {
    const row = await this.prisma.integrationSource.create({
      data: {
        projectId: draft.projectId,
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
        ...(check.changed
          ? {
              changedAt: check.at,
              changedBy:
                check.by == null
                  ? Prisma.DbNull
                  : { name: check.by.name, email: check.by.email },
            }
          : {}),
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

  async findByChannel(channelId: string): Promise<SourceLink | null> {
    const row = await this.prisma.integrationSource.findUnique({
      where: { watchChannelId: channelId },
    });
    return row === null ? null : toSource(row);
  }

  async saveChannel(
    id: string,
    channel: PushChannel | null,
  ): Promise<SourceLink> {
    const row = await this.prisma.integrationSource.update({
      where: { id },
      data: {
        watchChannelId: channel?.id ?? null,
        watchResourceId: channel?.resourceId ?? null,
        watchToken: channel?.token ?? null,
        watchExpiresAt: channel?.expiresAt ?? null,
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
