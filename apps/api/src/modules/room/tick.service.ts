import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@team27/data-main';
import { isActive } from '@team27/context-lake';

import {
  delayFor,
  planVote,
  PRESENTER_REOPEN_DELAY_MS,
  SCENE_PAUSE_MS,
  scaled,
} from '../../scenario/bots.ts';
import { findFixture } from '../../scenario/documents.ts';
import { LOS_AROMOS } from '../../scenario/los-aromos.ts';
import {
  AUTOPLAY_CHAIN,
  findScene,
  type HasRevision,
  type Scene,
  sceneProgress,
  unmetRequirement,
} from '../../scenario/scenes.ts';
import { CoordinationService } from '../coordination/coordination.service.ts';
import { castName } from '../coordination/lookup.ts';
import { QueryService } from '../coordination/query.service.ts';
import type { LakeSnapshot } from '../coordination/views.ts';
import { PRISMA_CLIENT } from '../database/prisma-token.ts';
import { TICK_LOCK } from '../database/unit-of-work.ts';
import { emitEvents } from './events.ts';
import { SeatsService } from './seats.service.ts';
import { readState, ROOM_STATE_ID, type RoomStateView } from './state.ts';

const MIN_GAP_MS = 500;

const MAX_TASKS_PER_TICK = 5;

type Tx = Prisma.TransactionClient;

interface TaskPayload {
  fixtureId?: string;
  proposalId?: string;
  notificationId?: string;
  voteKind?: 'reviewed' | 'issue';
  note?: string;
}

const describeFailure = (error: unknown): string => {
  if (error instanceof HttpException) {
    const body = error.getResponse();
    if (typeof body === 'object' && 'code' in body) return String(body.code);
  }
  return error instanceof Error ? error.message : String(error);
};

export const hasRevisionIn =
  (snapshot: LakeSnapshot): HasRevision =>
  (documentId, label) =>
    snapshot.revisions.some(
      (revision) =>
        revision.documentId === documentId && revision.label === label,
    );

@Injectable()
export class TickService {
  private readonly logger = new Logger(TickService.name);
  private readonly prisma: PrismaClient;
  private readonly coordination: CoordinationService;
  private readonly queries: QueryService;
  private readonly seats: SeatsService;
  private lastTick = 0;
  private running = false;

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

  async tick(options: { force?: boolean } = {}): Promise<void> {
    const now = Date.now();
    if (this.running) return;
    if (!options.force && now - this.lastTick < MIN_GAP_MS) return;
    this.running = true;
    this.lastTick = now;
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<
            { locked: boolean }[]
          >`SELECT pg_try_advisory_xact_lock(${TICK_LOCK}::bigint) AS locked`;
          if (!rows[0]?.locked) return;
          await this.round(tx);
        },
        { timeout: 30_000, maxWait: 5_000 },
      );
    } catch (error) {
      this.logger.error(
        'Falló el tick de los bots',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  private async round(tx: Tx): Promise<void> {
    const snapshot = await this.queries.snapshot();
    const state = await readState(tx);
    const now = new Date();
    await this.advanceScenes(tx, state, snapshot, now);
    await this.ensureSceneTasks(tx, snapshot, now);
    await this.reconcile(tx, state, snapshot, now);
    await this.execute(tx, now);
  }

  private async advanceScenes(
    tx: Tx,
    state: RoomStateView,
    snapshot: LakeSnapshot,
    now: Date,
  ): Promise<void> {
    const has = hasRevisionIn(snapshot);
    const anyActive = snapshot.proposals.some(isActive);
    const active = state.activeScene ? findScene(state.activeScene) : undefined;
    if (active) {
      if (sceneProgress(active, has).complete && !anyActive) {
        await tx.roomState.update({
          where: { id: ROOM_STATE_ID },
          data: {
            activeScene: null,
            pauseUntil: new Date(
              now.getTime() + scaled(SCENE_PAUSE_MS, state.speed),
            ),
          },
        });
      }
      return;
    }
    if (!state.autoplay || anyActive) return;
    if (state.pauseUntil && state.pauseUntil.getTime() > now.getTime()) return;
    const next = AUTOPLAY_CHAIN.map(findScene).find(
      (scene): scene is Scene =>
        scene !== undefined && !sceneProgress(scene, has).complete,
    );
    if (!next) return;
    await tx.roomState.update({
      where: { id: ROOM_STATE_ID },
      data: { activeScene: next.id, pauseUntil: null },
    });
    await emitEvents(tx, [
      {
        kind: 'scene.started',
        message: `Escena: ${next.label}.`,
        refs: { sceneId: next.id },
      },
    ]);
  }

  private async ensureSceneTasks(
    tx: Tx,
    snapshot: LakeSnapshot,
    now: Date,
  ): Promise<void> {
    const current = await readState(tx);
    const scene = current.activeScene ? findScene(current.activeScene) : null;
    if (!scene) return;
    const has = hasRevisionIn(snapshot);
    const { remaining } = sceneProgress(scene, has);
    const data = remaining
      .filter((fixture) => unmetRequirement(fixture, has) === null)
      .map((fixture) => ({
        key: `drop:${fixture.id}`,
        castId: fixture.seat,
        kind: 'drop',
        payload: { fixtureId: fixture.id } satisfies TaskPayload,
        dueAt: new Date(
          now.getTime() + scaled(delayFor(fixture.seat), current.speed),
        ),
      }));
    if (data.length > 0) {
      await tx.botTask.createMany({ data, skipDuplicates: true });
    }
  }

  private async reconcile(
    tx: Tx,
    state: RoomStateView,
    snapshot: LakeSnapshot,
    now: Date,
  ): Promise<void> {
    const active = snapshot.proposals.filter(isActive);
    if (active.length === 0) return;
    const reopened = await tx.roomEvent.findMany({
      where: { kind: 'proposal.reopened' },
      select: { refs: true },
    });
    const rounds = new Map<string, number>();
    for (const event of reopened) {
      const refs = event.refs as { proposalId?: string } | null;
      if (refs?.proposalId) {
        rounds.set(refs.proposalId, (rounds.get(refs.proposalId) ?? 0) + 1);
      }
    }
    const data: Prisma.BotTaskCreateManyInput[] = [];
    for (const proposal of active) {
      const round = rounds.get(proposal.id) ?? 0;
      for (const review of proposal.reviews) {
        if (review.decision !== null) continue;
        const notification = snapshot.notifications.find(
          (item) =>
            item.changeId === proposal.changeId &&
            item.stakeholderId === review.reviewerId,
        );
        if (!notification) continue;
        const plan = planVote({
          castId: review.reviewerId,
          subjectId: proposal.subject,
          round,
        });
        data.push({
          key: `vote:${proposal.id}:${review.reviewerId}:${round}`,
          castId: review.reviewerId,
          kind: 'vote',
          payload: {
            proposalId: proposal.id,
            notificationId: notification.id,
            voteKind: plan.kind,
            note: plan.note,
          } satisfies TaskPayload,
          dueAt: new Date(now.getTime() + scaled(plan.delayMs, state.speed)),
        });
      }
      if (state.autoplay && proposal.status === 'disputed') {
        data.push({
          key: `reopen:${proposal.id}:${round}`,
          castId: LOS_AROMOS.author.id,
          kind: 'reopen',
          payload: { proposalId: proposal.id } satisfies TaskPayload,
          dueAt: new Date(
            now.getTime() + scaled(PRESENTER_REOPEN_DELAY_MS, state.speed),
          ),
        });
      }
    }
    if (data.length > 0) {
      await tx.botTask.createMany({ data, skipDuplicates: true });
    }
  }

  private async execute(tx: Tx, now: Date): Promise<void> {
    const state = await readState(tx);
    const due = await tx.botTask.findMany({
      where: { doneAt: null, dueAt: { lte: now } },
      orderBy: [{ dueAt: 'asc' }, { key: 'asc' }],
      take: 20,
    });
    if (due.length === 0) return;
    const present = await this.seats.presentIds();
    let ran = 0;
    for (const task of due) {
      if (ran >= MAX_TASKS_PER_TICK) break;
      if (present.has(task.castId)) continue;
      if (task.kind === 'reopen' && !state.autoplay) continue;
      const result = await this.perform(task.kind, task.castId, {
        ...(task.payload as TaskPayload),
      });
      await tx.botTask.update({
        where: { id: task.id },
        data: { doneAt: new Date(), result },
      });
      ran += 1;
    }
  }

  private async perform(
    kind: string,
    castId: string,
    payload: TaskPayload,
  ): Promise<string> {
    try {
      if (kind === 'drop' && payload.fixtureId) {
        const fixture = findFixture(payload.fixtureId);
        if (!fixture) return 'error:fixture';
        await this.coordination.drop({
          seat: castId,
          spaceId: fixture.spaceId,
          fixtureId: fixture.id,
          actionId: undefined,
        });
        return 'ok';
      }
      if (kind === 'vote' && payload.notificationId && payload.voteKind) {
        await this.coordination.vote({
          seat: castId,
          notificationId: payload.notificationId,
          vote: { kind: payload.voteKind, note: payload.note ?? null },
          actionId: undefined,
        });
        return 'ok';
      }
      if (kind === 'reopen' && payload.proposalId) {
        await this.coordination.reopen({
          seat: castId,
          proposalId: payload.proposalId,
        });
        return 'ok';
      }
      return 'error:kind';
    } catch (error) {
      const message = describeFailure(error);
      this.logger.warn(`Tarea de ${castName(castId)} sin efecto: ${message}`);
      return `skipped:${message.slice(0, 120)}`;
    }
  }
}
