import type { Prisma, PrismaClient } from '@team27/data-main';

import type { ImpactRepository } from '../../application/ports/ImpactRepository.ts';
import type { Impact } from '../../domain/Impact.ts';

type ImpactDetail = Omit<Impact, 'changeId' | 'costDelta' | 'delayDays'>;

export class PrismaImpactRepository implements ImpactRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async save(impact: Impact): Promise<void> {
    const { changeId, costDelta, delayDays, ...detail } = impact;
    const data = {
      costDelta,
      delayDays,
      detail: detail as unknown as Prisma.InputJsonValue,
    };
    await this.prisma.impact.upsert({
      where: { changeId },
      create: { changeId, ...data },
      update: data,
    });
  }

  async findByChangeIds(changeIds: readonly string[]): Promise<Impact[]> {
    const rows = await this.prisma.impact.findMany({
      where: { changeId: { in: [...changeIds] } },
    });
    return rows.map((row) => ({
      changeId: row.changeId,
      costDelta: row.costDelta,
      delayDays: row.delayDays,
      ...(row.detail as unknown as ImpactDetail),
    }));
  }
}
