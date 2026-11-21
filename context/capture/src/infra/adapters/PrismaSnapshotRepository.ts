import type { Prisma, PrismaClient } from '@team27/data-main';

import type { SnapshotRepository } from '../../application/ports/SnapshotRepository.ts';
import type { ModelElement, Snapshot } from '../../domain/ModelElement.ts';

export class PrismaSnapshotRepository implements SnapshotRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async latest(integrationId: string): Promise<Snapshot | null> {
    const row = await this.prisma.snapshot.findFirst({
      where: { integrationId },
      orderBy: { version: 'desc' },
    });
    if (!row) return null;
    return {
      integrationId: row.integrationId,
      version: row.version,
      publishedAt: row.publishedAt,
      elements: row.elements as unknown as ModelElement[],
    };
  }

  async save(snapshot: Snapshot): Promise<void> {
    await this.prisma.snapshot.create({
      data: {
        integrationId: snapshot.integrationId,
        version: snapshot.version,
        publishedAt: snapshot.publishedAt,
        elements: snapshot.elements as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
