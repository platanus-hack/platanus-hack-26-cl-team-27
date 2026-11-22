import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@team27/data-main';

import { CoordinationService } from '../coordination/coordination.service.ts';
import { QueryService } from '../coordination/query.service.ts';
import { castView } from '../coordination/views.ts';
import type { ProjectCatalog } from '../project/project-catalog.ts';
import { PROJECT_CATALOG } from '../project/project.module.ts';
import { PRISMA_CLIENT } from '../database/prisma-token.ts';
import { EventsHub, type HubEvent } from './events-hub.ts';
import { HEARTBEAT_MIN_MS, SeatsService } from './seats.service.ts';
import { readState } from './state.ts';

export interface EventsRequest {
  readonly after: number | undefined;
  readonly epoch: number | undefined;
  readonly limit: number;
  readonly token: string | undefined;
  readonly waitSeconds?: number;
  readonly signal?: AbortSignal;
}

const eventView = (row: HubEvent) => ({
  seq: row.seq,
  kind: row.kind,
  type: row.kind,
  message: row.message,
  refs: row.refs,
  at: row.at,
});

@Injectable()
export class RoomService {
  private readonly prisma: PrismaClient;
  private readonly coordination: CoordinationService;
  private readonly queries: QueryService;
  private readonly seats: SeatsService;
  private readonly project: ProjectCatalog;
  private readonly hub: EventsHub;

  constructor(
    @Inject(PRISMA_CLIENT) prisma: PrismaClient,
    @Inject(CoordinationService) coordination: CoordinationService,
    @Inject(QueryService) queries: QueryService,
    @Inject(SeatsService) seats: SeatsService,
    @Inject(PROJECT_CATALOG) project: ProjectCatalog,
    @Inject(EventsHub) hub: EventsHub,
  ) {
    this.hub = hub;
    this.prisma = prisma;
    this.coordination = coordination;
    this.queries = queries;
    this.seats = seats;
    this.project = project;
  }

  private async cursor(): Promise<number> {
    const aggregate = await this.prisma.roomEvent.aggregate({
      where: { projectId: this.project.id },
      _max: { seq: true },
    });
    return aggregate._max.seq ?? 0;
  }

  async room() {
    const [state, cursor, present] = await Promise.all([
      readState(this.prisma, this.project.id),
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
    const member = this.project.castMember(castId);
    return {
      castId: claimed.castId,
      token: claimed.token,
      cast: member ? castView(this.project, member, new Set([castId])) : null,
    };
  }

  async events(request: EventsRequest) {
    const started = Date.now();
    const seat = await this.seats.heartbeat(request.token);
    const [state, cursor] = await Promise.all([
      readState(this.prisma, this.project.id),
      this.cursor(),
    ]);
    const base = { epoch: state.epoch, seat, longPoll: true };
    const stale =
      (request.epoch !== undefined && request.epoch !== state.epoch) ||
      (request.after !== undefined && request.after > cursor);
    if (stale) return { ...base, cursor, reset: true, events: [] };
    const after = request.after;
    if (after === undefined) {
      return { ...base, cursor, reset: false, events: [] };
    }
    const rows: readonly HubEvent[] =
      after === cursor
        ? []
        : await this.prisma.roomEvent.findMany({
            where: {
              projectId: this.project.id,
              seq: { gt: after },
              epoch: state.epoch,
            },
            orderBy: { seq: 'asc' },
            take: request.limit,
          });
    const waitSeconds = request.waitSeconds ?? 0;
    if (rows.length > 0 || waitSeconds <= 0) {
      return this.answer(base, after, rows);
    }
    const outcome = await this.hub.wait({
      projectId: this.project.id,
      epoch: state.epoch,
      after,
      limit: request.limit,
      waitMs: waitSeconds * 1000,
      ...(request.signal ? { signal: request.signal } : {}),
    });
    if (outcome.kind === 'aborted') return this.answer(base, after, []);
    const beat =
      outcome.kind === 'reset' || Date.now() - started >= HEARTBEAT_MIN_MS
        ? await this.seats.heartbeat(request.token)
        : seat;
    const waited = { ...base, seat: beat };
    if (outcome.kind === 'reset') {
      return {
        ...waited,
        epoch: outcome.epoch,
        cursor: outcome.cursor,
        reset: true,
        events: [],
      };
    }
    return this.answer(
      waited,
      after,
      outcome.kind === 'events' ? outcome.events : [],
    );
  }

  private answer<B extends object>(
    base: B,
    after: number,
    rows: readonly HubEvent[],
  ) {
    const last = rows[rows.length - 1];
    return {
      ...base,
      cursor: last ? last.seq : after,
      reset: false,
      events: rows.map(eventView),
    };
  }

  async reset(): Promise<{ epoch: number }> {
    await this.coordination.reset();
    const state = await readState(this.prisma, this.project.id);
    return { epoch: state.epoch };
  }
}
