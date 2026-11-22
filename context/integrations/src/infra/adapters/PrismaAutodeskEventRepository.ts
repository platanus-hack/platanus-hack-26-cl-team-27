import type { PrismaClient } from '@team27/data-main';

import type { AutodeskEventRepository } from '../../application/ports/index.ts';
import type { AutodeskChange } from '../../domain/autodesk/AutodeskChange.ts';

export class PrismaAutodeskEventRepository implements AutodeskEventRepository {
  private readonly prisma: Pick<PrismaClient, 'autodeskEvent'>;

  constructor(prisma: Pick<PrismaClient, 'autodeskEvent'>) {
    this.prisma = prisma;
  }

  async recordIfNew(
    change: AutodeskChange,
    receivedAt: Date,
  ): Promise<boolean> {
    const { resource } = change;
    const { count } = await this.prisma.autodeskEvent.createMany({
      data: [
        {
          dedupeKey: change.dedupeKey,
          event: change.event,
          kind: change.kind,
          source: change.source,
          hookId: change.hookId,
          resourceKind: resource.kind,
          resourceUrn: resource.urn,
          lineageUrn: resource.lineageUrn,
          name: resource.name,
          version: resource.version,
          folderUrn: resource.parentFolderUrn,
          projectId: resource.projectId,
          actorId: change.actorId,
          occurredAt:
            change.occurredAt === null ? null : new Date(change.occurredAt),
          needsElementDiff: change.needsElementDiff,
          receivedAt,
        },
      ],
      skipDuplicates: true,
    });
    return count === 1;
  }
}
