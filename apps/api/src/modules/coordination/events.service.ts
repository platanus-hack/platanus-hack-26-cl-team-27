import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@team27/data-main';

import { PRISMA_CLIENT } from '../database/database.module.ts';

@Injectable()
export class EventsService {
  private readonly prisma: PrismaClient;

  constructor(@Inject(PRISMA_CLIENT) prisma: PrismaClient) {
    this.prisma = prisma;
  }

  private async cursor(projectId: string): Promise<number> {
    const aggregate = await this.prisma.projectEvent.aggregate({
      where: { projectId },
      _max: { seq: true },
    });
    return aggregate._max.seq ?? 0;
  }

  async list(projectId: string, after: number | undefined, limit: number) {
    const cursor = await this.cursor(projectId);
    if (after === undefined) return { cursor, reset: false, events: [] };
    if (after > cursor) return { cursor, reset: true, events: [] };
    const rows = await this.prisma.projectEvent.findMany({
      where: { projectId, seq: { gt: after } },
      orderBy: { seq: 'asc' },
      take: limit,
    });
    const last = rows[rows.length - 1];
    return {
      cursor: last ? last.seq : after,
      reset: false,
      events: rows.map((row) => ({
        seq: row.seq,
        kind: row.kind,
        message: row.message,
        refs: row.refs,
        at: row.at,
      })),
    };
  }
}
