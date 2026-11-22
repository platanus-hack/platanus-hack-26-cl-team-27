import type { PrismaClient } from '@team27/data-main';

import type { EventsProbe, EventsStore, HubEvent } from './events-hub.ts';
import { readState } from './state.ts';

interface ProbeRow {
  readonly epoch: number;
  readonly maxSeq: number;
}

export class PrismaEventsStore implements EventsStore {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async probe(projectId: string): Promise<EventsProbe> {
    const [row] = await this.prisma.$queryRaw<ProbeRow[]>`
      SELECT
        COALESCE((SELECT epoch FROM room_state WHERE project_id = ${projectId}), 0)::int AS "epoch",
        COALESCE((SELECT MAX(seq) FROM room_events WHERE project_id = ${projectId}), 0)::int AS "maxSeq"`;
    if (row && row.epoch > 0) return row;
    const state = await readState(this.prisma, projectId);
    return { epoch: state.epoch, maxSeq: row?.maxSeq ?? 0 };
  }

  fetch(
    projectId: string,
    epoch: number,
    after: number,
    take: number,
  ): Promise<readonly HubEvent[]> {
    return this.prisma.roomEvent.findMany({
      where: { projectId, seq: { gt: after }, epoch },
      orderBy: { seq: 'asc' },
      take,
    });
  }
}
