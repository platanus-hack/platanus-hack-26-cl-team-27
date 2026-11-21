import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@team27/data-main';

import { CoordinationService } from '../coordination/coordination.service.ts';
import { castMember } from '../coordination/lookup.ts';
import { QueryService } from '../coordination/query.service.ts';
import { castView } from '../coordination/views.ts';
import { PRISMA_CLIENT } from '../database/prisma-token.ts';
import { SeatsService } from './seats.service.ts';
import { readState } from './state.ts';

export interface EventsRequest {
  readonly after: number | undefined;
  readonly epoch: number | undefined;
  readonly limit: number;
  readonly token: string | undefined;
}

@Injectable()
export class RoomService {
  private readonly prisma: PrismaClient;
  private readonly coordination: CoordinationService;
  private readonly queries: QueryService;
  private readonly seats: SeatsService;

  constructor(
    @Inject(PRISMA_CLIENT) prisma: PrismaClient,
    @Inject(CoordinationService) coordination: CoordinationService,
    @Inject(QueryService) queries: QueryService,
    @Inject(SeatsService) seats: SeatsService,
  ) {
    this.prisma = prisma;
    this.coordination = coordination;
    this.queries = queries;
    this.seats = seats;
  }

  private async cursor(): Promise<number> {
    const aggregate = await this.prisma.roomEvent.aggregate({
      _max: { seq: true },
    });
    return aggregate._max.seq ?? 0;
  }

  async room() {
    const [state, cursor, present] = await Promise.all([
      readState(this.prisma),
      this.cursor(),
      this.seats.presentIds(),
    ]);
    return this.queries.room({
      epoch: state.epoch,
      cursor,
      present,
    });
  }

  async claim(castId: string) {
    const claimed = await this.seats.claim(castId);
    const member = castMember(castId);
    return {
      castId: claimed.castId,
      token: claimed.token,
      cast: member ? castView(member, new Set([castId])) : null,
    };
  }

  async events(request: EventsRequest) {
    const seat = await this.seats.heartbeat(request.token);
    const [state, cursor] = await Promise.all([
      readState(this.prisma),
      this.cursor(),
    ]);
    const base = { epoch: state.epoch, seat };
    const stale =
      (request.epoch !== undefined && request.epoch !== state.epoch) ||
      (request.after !== undefined && request.after > cursor);
    if (stale) return { ...base, cursor, reset: true, events: [] };
    if (request.after === undefined) {
      return { ...base, cursor, reset: false, events: [] };
    }
    const rows = await this.prisma.roomEvent.findMany({
      where: { seq: { gt: request.after }, epoch: state.epoch },
      orderBy: { seq: 'asc' },
      take: request.limit,
    });
    const last = rows[rows.length - 1];
    return {
      ...base,
      cursor: last ? last.seq : request.after,
      reset: false,
      events: rows.map((row) => ({
        seq: row.seq,
        kind: row.kind,
        type: row.kind,
        message: row.message,
        refs: row.refs,
        at: row.at,
      })),
    };
  }

  async reset(): Promise<{ epoch: number }> {
    await this.coordination.reset();
    const state = await readState(this.prisma);
    return { epoch: state.epoch };
  }
}
