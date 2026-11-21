import type { Prisma, PrismaClient } from '@team27/data-main';

import type { ImpactRepository } from '../../application/ports/ImpactRepository.ts';
import type { Impact } from '../../domain/Impact.ts';

type ImpactDetail = Omit<Impact, 'changeId' | 'costDelta' | 'delayDays'>;

export class PrismaImpactRepository implements ImpactRepository {
  private readonly prisma: PrismaClient;
  private readonly projectId: string;

  constructor(prisma: PrismaClient, projectId: string) {
    this.prisma = prisma;
    this.projectId = projectId;
  }

  async save(impact: Impact): Promise<void> {
    const { changeId, costDelta, delayDays, ...detail } = impact;
    const data = {
      costDelta,
      delayDays,
      detail: detail as unknown as Prisma.InputJsonValue,
    };
    await this.prisma.impact.upsert({
      where: { changeId, projectId: this.projectId },
      create: { changeId, projectId: this.projectId, ...data },
      update: data,
    });
  }

  async findByChangeIds(changeIds: readonly string[]): Promise<Impact[]> {
    const rows = await this.prisma.impact.findMany({
      where: { projectId: this.projectId, changeId: { in: [...changeIds] } },
    });
    return rows.map((row) => ({
      changeId: row.changeId,
      costDelta: row.costDelta,
      delayDays: row.delayDays,
      ...(row.detail as unknown as ImpactDetail),
    }));
  }
}
