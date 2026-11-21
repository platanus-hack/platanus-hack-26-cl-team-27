import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@team27/data-main';

import {
  findScene,
  type HasRevision,
  SCENES,
  sceneProgress,
  unmetRequirement,
} from '../../scenario/scenes.ts';
import { CoordinationService } from '../coordination/coordination.service.ts';
import { fail } from '../coordination/http-errors.ts';
import { castMember, documentDef } from '../coordination/lookup.ts';
import { QueryService } from '../coordination/query.service.ts';
import { castView } from '../coordination/views.ts';
import { PRISMA_CLIENT } from '../database/prisma-token.ts';
import { emitEvents } from './events.ts';
import { hasRevisionIn, TickService } from './tick.service.ts';
import { SeatsService } from './seats.service.ts';
import { readState, ROOM_STATE_ID, type Speed } from './state.ts';

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
  private readonly ticks: TickService;

  constructor(
    @Inject(PRISMA_CLIENT) prisma: PrismaClient,
    @Inject(CoordinationService) coordination: CoordinationService,
    @Inject(QueryService) queries: QueryService,
    @Inject(SeatsService) seats: SeatsService,
    @Inject(TickService) ticks: TickService,
  ) {
    this.prisma = prisma;
    this.coordination = coordination;
    this.queries = queries;
    this.seats = seats;
    this.ticks = ticks;
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
      autoplay: { enabled: state.autoplay, speed: state.speed },
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
    await this.ticks.tick();
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

  async scenes() {
    const [state, snapshot] = await Promise.all([
      readState(this.prisma),
      this.queries.snapshot(),
    ]);
    const has = hasRevisionIn(snapshot);
    return {
      scenes: SCENES.map((scene) => {
        const progress = sceneProgress(scene, has);
        const reason = this.disabledReason(scene.id, state.activeScene, has);
        return {
          id: scene.id,
          label: scene.label,
          hint: scene.hint,
          extra: scene.extra,
          status: progress.complete
            ? ('played' as const)
            : state.activeScene === scene.id
              ? ('running' as const)
              : ('pending' as const),
          playable: reason === null,
          disabledReason: reason,
        };
      }),
      autoplay: { enabled: state.autoplay, speed: state.speed },
    };
  }

  private disabledReason(
    sceneId: string,
    activeScene: string | null,
    has: HasRevision,
  ): string | null {
    const scene = findScene(sceneId);
    if (!scene) return 'La escena no existe';
    const progress = sceneProgress(scene, has);
    if (progress.complete) return 'La escena ya se jugó';
    if (activeScene && activeScene !== sceneId) {
      return 'Hay otra escena en curso';
    }
    for (const fixture of progress.remaining) {
      const missing = unmetRequirement(fixture, has);
      if (missing) {
        return `Antes hay que soltar ${documentDef(missing.documentId)?.name ?? missing.documentId} ${missing.label}`;
      }
    }
    return null;
  }

  async play(sceneId: string): Promise<void> {
    const scene = findScene(sceneId);
    if (!scene) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        `No existe la escena ${sceneId}`,
      );
    }
    const [state, snapshot] = await Promise.all([
      readState(this.prisma),
      this.queries.snapshot(),
    ]);
    const has = hasRevisionIn(snapshot);
    const reason = this.disabledReason(scene.id, state.activeScene, has);
    if (reason) {
      throw fail(HttpStatus.CONFLICT, 'scene_unavailable', reason);
    }
    await this.prisma.roomState.update({
      where: { id: ROOM_STATE_ID },
      data: { activeScene: scene.id, pauseUntil: null },
    });
    await emitEvents(this.prisma, [
      {
        kind: 'scene.started',
        message: `Escena: ${scene.label}.`,
        refs: { sceneId: scene.id },
      },
    ]);
    await this.ticks.tick({ force: true });
  }

  async setAutoplay(enabled: boolean, speed: Speed): Promise<void> {
    await readState(this.prisma);
    await this.prisma.roomState.update({
      where: { id: ROOM_STATE_ID },
      data: {
        autoplay: enabled,
        speed,
        ...(enabled ? { pauseUntil: null } : {}),
      },
    });
    await emitEvents(this.prisma, [
      {
        kind: 'autoplay.changed',
        message: enabled
          ? `Autoplay encendido a velocidad ${speed}x.`
          : 'Autoplay apagado.',
        refs: { speed },
      },
    ]);
    await this.ticks.tick({ force: true });
  }

  async reset(): Promise<{ epoch: number }> {
    await this.coordination.reset();
    const state = await readState(this.prisma);
    return { epoch: state.epoch };
  }
}
