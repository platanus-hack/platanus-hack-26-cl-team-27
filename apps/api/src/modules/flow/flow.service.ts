import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@team27/data-main';

import { CASE_ATTRIBUTE, caseSubject } from '../../scenario/caso-p12.ts';
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

@Injectable()
export class FlowService {
  private readonly uow: UnitOfWork;
  private readonly seats: SeatsService;
  private readonly project: ProjectCatalog;
  private seen: FlowStore['presence'] = new Map();
  private seenEpoch = -1;

  constructor(
    @Inject(UnitOfWork) uow: UnitOfWork,
    @Inject(SeatsService) seats: SeatsService,
    @Inject(PROJECT_CATALOG) project: ProjectCatalog,
  ) {
    this.uow = uow;
    this.seats = seats;
    this.project = project;
  }

  private scoped<T>(work: (scope: Scope) => Promise<T>): Promise<T> {
    return this.uow.run(async (db) => {
      const lake = buildLake(db, this.project);
      await seedCase(lake);
      const { epoch } = await readState(db, this.project.id);
      if (epoch !== this.seenEpoch) {
        this.seen = new Map();
        this.seenEpoch = epoch;
      }
      return work({
        db,
        lake,
        epoch,
        store: () => loadStore(lake, epoch, this.project, this.seen),
      });
    });
  }

  private async view(store: FlowStore): Promise<FlowState> {
    return viewStore(store, await this.seats.presentIds(), Date.now());
  }

  async state(): Promise<FlowState> {
    const store = await this.scoped((scope) => scope.store());
    return this.view(store);
  }

  async history() {
    return this.scoped(async ({ lake, epoch }) => {
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
