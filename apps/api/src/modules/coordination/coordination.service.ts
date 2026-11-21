import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import {
  type Change,
  GetChange,
  GetLatestSnapshot,
  ListChanges,
  type ModelElement,
  PublishVersion,
  type Snapshot,
} from '@team27/context-capture';
import { AnalyzeChange, GetImpacts } from '@team27/context-impact';
import {
  ListNotifications,
  NotifyStakeholders,
} from '@team27/context-notification';
import type { PrismaClient } from '@team27/data-main';

import { LOS_AROMOS } from '../../scenario/los-aromos.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import { composeFeed, type FeedChange } from './feed.ts';

export interface PublishResult {
  readonly version: number;
  readonly changeIds: readonly string[];
}

@Injectable()
export class CoordinationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CoordinationService.name);
  private readonly publishVersion: PublishVersion;
  private readonly getLatestSnapshot: GetLatestSnapshot;
  private readonly listChanges: ListChanges;
  private readonly getChange: GetChange;
  private readonly analyzeChange: AnalyzeChange;
  private readonly getImpacts: GetImpacts;
  private readonly notifyStakeholders: NotifyStakeholders;
  private readonly listNotifications: ListNotifications;
  private readonly prisma: PrismaClient;

  constructor(
    @Inject(PublishVersion) publishVersion: PublishVersion,
    @Inject(GetLatestSnapshot) getLatestSnapshot: GetLatestSnapshot,
    @Inject(ListChanges) listChanges: ListChanges,
    @Inject(GetChange) getChange: GetChange,
    @Inject(AnalyzeChange) analyzeChange: AnalyzeChange,
    @Inject(GetImpacts) getImpacts: GetImpacts,
    @Inject(NotifyStakeholders) notifyStakeholders: NotifyStakeholders,
    @Inject(ListNotifications) listNotifications: ListNotifications,
    @Inject(PRISMA_CLIENT) prisma: PrismaClient,
  ) {
    this.publishVersion = publishVersion;
    this.getLatestSnapshot = getLatestSnapshot;
    this.listChanges = listChanges;
    this.getChange = getChange;
    this.analyzeChange = analyzeChange;
    this.getImpacts = getImpacts;
    this.notifyStakeholders = notifyStakeholders;
    this.listNotifications = listNotifications;
    this.prisma = prisma;
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      const latest = await this.getLatestSnapshot.execute(
        LOS_AROMOS.integration.id,
      );
      if (!latest) await this.publishBaseline();
    } catch (error) {
      this.logger.error(
        'No se pudo preparar el modelo base de la demo',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  latestModel(integrationId: string): Promise<Snapshot | null> {
    return this.getLatestSnapshot.execute(integrationId);
  }

  async publish(
    integrationId: string,
    elements: readonly ModelElement[],
  ): Promise<PublishResult> {
    const { version, changes } = await this.publishVersion.execute({
      integrationId,
      elements,
    });
    for (const change of changes) await this.propagate(change);
    return { version, changeIds: changes.map((change) => change.id) };
  }

  async feed(limit: number): Promise<FeedChange[]> {
    return this.compose(await this.listChanges.execute(limit));
  }

  async change(id: string): Promise<FeedChange | null> {
    const change = await this.getChange.execute(id);
    if (!change) return null;
    const [composed] = await this.compose([change]);
    return composed ?? null;
  }

  async reset(): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.notification.deleteMany(),
      this.prisma.impact.deleteMany(),
      this.prisma.change.deleteMany(),
      this.prisma.snapshot.deleteMany(),
    ]);
    await this.publishBaseline();
  }

  private async publishBaseline(): Promise<void> {
    await this.publishVersion.execute({
      integrationId: LOS_AROMOS.integration.id,
      elements: LOS_AROMOS.model,
    });
  }

  private async propagate(change: Change): Promise<void> {
    const impact = await this.analyzeChange.execute({
      id: change.id,
      elementId: change.element.id,
      elementName: change.element.name,
      category: change.element.category,
      changedKeys: change.diffs.map((diff) => diff.key),
      before: change.before,
      after: change.after,
    });
    await this.notifyStakeholders.execute({
      changeId: change.id,
      title: `${change.element.name} · ${change.summary}`,
      findings: impact.findings,
    });
  }

  private async compose(changes: readonly Change[]): Promise<FeedChange[]> {
    const ids = changes.map((change) => change.id);
    const [impacts, notifications] = await Promise.all([
      this.getImpacts.execute(ids),
      this.listNotifications.execute({ changeIds: ids }),
    ]);
    return composeFeed(
      changes,
      impacts,
      notifications,
      LOS_AROMOS.stakeholders.map((stakeholder) => stakeholder.id),
    );
  }
}
