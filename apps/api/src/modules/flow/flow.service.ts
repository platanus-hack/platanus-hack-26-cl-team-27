import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@team27/data-main';

import { PRISMA_CLIENT } from '../database/prisma-token.ts';
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
  seedStore,
  submitMinute,
  viewStore,
} from './flow-engine.ts';

@Injectable()
export class FlowService {
  private readonly prisma: PrismaClient;
  private readonly seats: SeatsService;
  private readonly project: ProjectCatalog;
  private store: FlowStore | null = null;

  constructor(
    @Inject(PRISMA_CLIENT) prisma: PrismaClient,
    @Inject(SeatsService) seats: SeatsService,
    @Inject(PROJECT_CATALOG) project: ProjectCatalog,
  ) {
    this.prisma = prisma;
    this.seats = seats;
    this.project = project;
  }

  private async current(): Promise<FlowStore> {
    const { epoch } = await readState(this.prisma, this.project.id);
    if (!this.store || this.store.epoch !== epoch) {
      this.store = seedStore(epoch, this.project);
    }
    return this.store;
  }

  private async respond(
    store: FlowStore,
    events: readonly EventDraft[],
  ): Promise<FlowState> {
    await emitEvents(this.prisma, this.project.id, events);
    return viewStore(store, await this.seats.presentIds(), Date.now());
  }

  async state(): Promise<FlowState> {
    return this.respond(await this.current(), []);
  }

  async minute(
    credentials: Credentials,
    input: MinuteInput,
  ): Promise<FlowState> {
    const actor = await this.seats.actor(credentials);
    const store = await this.current();
    const outcome = submitMinute(store, actor, input, new Date());
    return this.respond(store, outcome === 'replay' ? [] : outcome.events);
  }

  async accept(credentials: Credentials, id: string): Promise<FlowState> {
    const actor = await this.seats.actor(credentials);
    const store = await this.current();
    return this.respond(
      store,
      acceptProposal(store, id, actor, new Date()).events,
    );
  }

  async reject(
    credentials: Credentials,
    id: string,
    reason: string,
  ): Promise<FlowState> {
    const actor = await this.seats.actor(credentials);
    const store = await this.current();
    return this.respond(
      store,
      rejectProposal(store, id, actor, reason, new Date()).events,
    );
  }

  async presence(
    credentials: Credentials,
    viewing: Viewing | null,
  ): Promise<FlowState> {
    const actor = await this.seats.actor(credentials);
    const store = await this.current();
    const outcome: Outcome = recordPresence(store, actor, viewing, Date.now());
    return this.respond(store, outcome.events);
  }

  async reset(key: string | undefined): Promise<FlowState> {
    this.seats.requirePresenter(key);
    const { epoch } = await readState(this.prisma, this.project.id);
    this.store = seedStore(epoch, this.project);
    return this.respond(this.store, [
      { kind: 'flow.reset', message: 'El caso volvió al comienzo.' },
    ]);
  }
}
