import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@team27/data-main';

import { CASE_ATTRIBUTE, caseSubject } from '../../scenario/caso-p12.ts';
import { KeyedMemo, type Resolved } from '../database/keyed-memo.ts';
import { PRISMA_CLIENT } from '../database/prisma-token.ts';
import { UnitOfWork } from '../database/unit-of-work.ts';
import { buildLake } from '../lake/lake.module.ts';
import type { ProjectCatalog } from '../project/project-catalog.ts';
import { PROJECT_CATALOG } from '../project/project.module.ts';
import { type EventDraft, emitEvents } from '../room/events.ts';
import { type Credentials, SeatsService } from '../room/seats.service.ts';
import { readState } from '../room/state.ts';
import {
  type FlowState,
  type FlowStore,
  type MinuteInput,
  type Outcome,
  type Viewing,
  acceptProposal,
  recordPresence,
  rejectProposal,
  submitMinute,
  viewStore,
} from './flow-engine.ts';
import { buildHistory } from './flow-history.ts';
import {
  type Lake,
  clearCase,
  loadStore,
  persistDecision,
  persistMinute,
  seedCase,
} from './flow-lake.ts';

type History = ReturnType<typeof buildHistory>;

interface Scope {
  readonly db: PrismaClient;
  readonly lake: Lake;
  readonly epoch: number;
  readonly store: () => Promise<FlowStore>;
}

const relink = (
  events: readonly EventDraft[],
  store: FlowStore,
): EventDraft[] =>
  events.map((event) => {
    if (!event.refs) return event;
    const refs: Record<string, string | number | string[]> = {
      ...event.refs,
    };
    if ('clashId' in refs && store.clash) refs['clashId'] = store.clash.id;
    if ('proposalId' in refs && store.proposal) {
      refs['proposalId'] = store.proposal.id;
    }
    return { ...event, refs };
  });

class StaleSeed extends Error {}

const MAX_ATTEMPTS = 3;

@Injectable()
export class FlowService {
  private readonly prisma: PrismaClient;
  private readonly uow: UnitOfWork;
  private readonly seats: SeatsService;
  private readonly project: ProjectCatalog;
  private readonly stores = new KeyedMemo<FlowStore>();
  private readonly histories = new KeyedMemo<History>();
  private seen: FlowStore['presence'] = new Map();
  private seenEpoch = -1;
  private seeded = -1;
  private seeding: Promise<void> | null = null;

  constructor(
    @Inject(PRISMA_CLIENT) prisma: PrismaClient,
    @Inject(UnitOfWork) uow: UnitOfWork,
    @Inject(SeatsService) seats: SeatsService,
    @Inject(PROJECT_CATALOG) project: ProjectCatalog,
  ) {
    this.prisma = prisma;
    this.uow = uow;
    this.seats = seats;
    this.project = project;
  }

  private syncSeen(epoch: number): void {
    if (epoch !== this.seenEpoch) {
      this.seen = new Map();
      this.seenEpoch = epoch;
    }
  }

  private scoped<T>(work: (scope: Scope) => Promise<T>): Promise<T> {
    let seededAt = this.seeded;
    return this.uow
      .run(async (db) => {
        const lake = buildLake(db, this.project);
        const { epoch } = await readState(db, this.project.id);
        if (epoch !== this.seeded) await seedCase(lake);
        seededAt = epoch;
        this.syncSeen(epoch);
        return work({
          db,
          lake,
          epoch,
          store: () => loadStore(lake, epoch, this.project, this.seen),
        });
      })
      .then((result) => {
        this.seeded = seededAt;
        return result;
      });
  }

  private async peek(): Promise<{ epoch: number | null; cursor: number }> {
    const [state, aggregate] = await Promise.all([
      this.prisma.roomState.findUnique({
        where: { projectId: this.project.id },
      }),
      this.prisma.roomEvent.aggregate({
        where: { projectId: this.project.id },
        _max: { seq: true },
      }),
    ]);
    return { epoch: state?.epoch ?? null, cursor: aggregate._max.seq ?? 0 };
  }

  private ensureSeeded(epoch: number | null): Promise<void> {
    if (epoch !== null && epoch === this.seeded) return Promise.resolve();
    this.seeding ??= this.uow
      .run(async (db) => {
        const lake = buildLake(db, this.project);
        const state = await readState(db, this.project.id);
        if (state.epoch !== this.seeded) await seedCase(lake);
        return state.epoch;
      })
      .then((seeded) => {
        this.seeded = seeded;
      })
      .finally(() => {
        this.seeding = null;
      });
    return this.seeding;
  }

  private keyOf(epoch: number | null, cursor: number): string {
    return `${this.project.id}:${epoch ?? 'none'}:${cursor}`;
  }

  private async derived<V>(
    memo: KeyedMemo<V>,
    build: (db: PrismaClient, epoch: number) => Promise<V>,
  ): Promise<V> {
    for (let attempt = 1; ; attempt++) {
      const { epoch, cursor } = await this.peek();
      await this.ensureSeeded(epoch);
      try {
        return await memo.get(this.keyOf(epoch, cursor), () =>
          this.uow.read(async (db): Promise<Resolved<V>> => {
            const state = await readState(db, this.project.id);
            const aggregate = await db.roomEvent.aggregate({
              where: { projectId: this.project.id },
              _max: { seq: true },
            });
            if (state.epoch !== this.seeded) throw new StaleSeed();
            return {
              key: this.keyOf(state.epoch, aggregate._max.seq ?? 0),
              value: await build(db, state.epoch),
            };
          }),
        );
      } catch (error) {
        if (!(error instanceof StaleSeed) || attempt >= MAX_ATTEMPTS) {
          throw error;
        }
      }
    }
  }

  private async view(store: FlowStore): Promise<FlowState> {
    return viewStore(store, await this.seats.presentIds(), Date.now());
  }

  async state(): Promise<FlowState> {
    const store = await this.derived(this.stores, (db, epoch) =>
      loadStore(buildLake(db, this.project), epoch, this.project, new Map()),
    );
    this.syncSeen(store.epoch);
    return this.view({ ...store, presence: this.seen });
  }

  async history() {
    return this.derived(this.histories, async (db, epoch) => {
      const lake = buildLake(db, this.project);
      const subjects = ['P-12', 'E-B-03'].map(caseSubject);
      const provenances = new Map(
        await Promise.all(
          subjects.map(
            async (subject) =>
              [
                subject,
                await lake.getProvenance.execute({
                  subject,
                  attribute: CASE_ATTRIBUTE,
                }),
              ] as const,
          ),
        ),
      );
      const chunks = await lake.ports.chunks.list();
      return buildHistory({
        epoch,
        cast: this.project,
        provenances,
        proposals: await lake.ports.proposals.list(),
        revisions: await lake.ports.revisions.list(),
        texts: new Map(chunks.map((chunk) => [chunk.revisionId, chunk.text])),
      });
    });
  }

  async minute(
    credentials: Credentials,
    input: MinuteInput,
  ): Promise<FlowState> {
    const actor = await this.seats.actor(credentials);
    const store = await this.scoped(async (scope) => {
      const current = await scope.store();
      const outcome = submitMinute(current, actor, input, new Date());
      if (outcome === 'replay') return current;
      await persistMinute(scope.lake, current, input);
      const fresh = await scope.store();
      await emitEvents(
        scope.db,
        this.project.id,
        relink(outcome.events, fresh),
      );
      return fresh;
    });
    return this.view(store);
  }

  async accept(credentials: Credentials, id: string): Promise<FlowState> {
    const actor = await this.seats.actor(credentials);
    const store = await this.scoped(async (scope) => {
      const current = await scope.store();
      const outcome = acceptProposal(current, id, actor, new Date());
      if (outcome.events.length === 0) return current;
      await persistDecision(scope.lake, 'accept', id, actor);
      const fresh = await scope.store();
      await emitEvents(scope.db, this.project.id, outcome.events);
      return fresh;
    });
    return this.view(store);
  }

  async reject(
    credentials: Credentials,
    id: string,
    reason: string,
  ): Promise<FlowState> {
    const actor = await this.seats.actor(credentials);
    const store = await this.scoped(async (scope) => {
      const current = await scope.store();
      const outcome = rejectProposal(current, id, actor, reason, new Date());
      if (outcome.events.length === 0) return current;
      await persistDecision(scope.lake, 'reject', id, actor, reason);
      const fresh = await scope.store();
      await emitEvents(scope.db, this.project.id, outcome.events);
      return fresh;
    });
    return this.view(store);
  }

  async presence(
    credentials: Credentials,
    viewing: Viewing | null,
  ): Promise<FlowState> {
    const actor = await this.seats.actor(credentials);
    const store = await this.scoped(async (scope) => {
      const current = await scope.store();
      const outcome: Outcome = recordPresence(
        current,
        actor,
        viewing,
        Date.now(),
      );
      await emitEvents(scope.db, this.project.id, outcome.events);
      return current;
    });
    return this.view(store);
  }

  async reset(key: string | undefined): Promise<FlowState> {
    this.seats.requirePresenter(key);
    const store = await this.scoped(async (scope) => {
      await clearCase(scope.lake);
      this.seen = new Map();
      await emitEvents(scope.db, this.project.id, [
        { kind: 'flow.reset', message: 'El caso volvió al comienzo.' },
      ]);
      return scope.store();
    });
    return this.view(store);
  }
}
