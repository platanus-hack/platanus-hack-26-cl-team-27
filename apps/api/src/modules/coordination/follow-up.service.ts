import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  escalationMemo,
  type FollowUpSettings,
  type Stakeholder,
} from '@team27/context-notification';
import type { PrismaClient } from '@team27/data-main';

import type { Env } from '../../config/index.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import { UnitOfWork } from '../database/unit-of-work.ts';
import { buildLake } from '../lake/lake.module.ts';
import { buildNotification } from '../notification/notification.module.ts';
import { ProjectCatalogs } from '../project/project.module.ts';
import { emitEvents, type EventDraft } from './events.ts';
import { awaitingNotices, escalationsOf } from './follow-up.ts';

export interface FollowUpRound {
  readonly reminded: number;
  readonly escalated: number;
}

export const ADMIN_ROLE = 'Administración del proyecto';

@Injectable()
export class FollowUpService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger('Seguimiento');
  private readonly prisma: PrismaClient;
  private readonly uow: UnitOfWork;
  private readonly catalogs: ProjectCatalogs;
  private readonly settings: FollowUpSettings;
  private readonly intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @Inject(PRISMA_CLIENT) prisma: PrismaClient,
    @Inject(UnitOfWork) uow: UnitOfWork,
    @Inject(ProjectCatalogs) catalogs: ProjectCatalogs,
    @Inject(ConfigService) config: ConfigService<Env, true>,
  ) {
    this.prisma = prisma;
    this.uow = uow;
    this.catalogs = catalogs;
    this.settings = {
      reminderAfterMs:
        config.get('REMINDER_AFTER_MINUTES', { infer: true }) * 60_000,
      escalateAfterReminders: config.get('ESCALATE_AFTER_REMINDERS', {
        infer: true,
      }),
    };
    this.intervalMs = config.get('FOLLOW_UP_SECONDS', { infer: true }) * 1000;
  }

  onApplicationBootstrap(): void {
    if (this.intervalMs === 0) {
      this.logger.log('Apagado: FOLLOW_UP_SECONDS es 0');
      return;
    }
    this.timer = setInterval(() => void this.safeTick(), this.intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async safeTick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const round = await this.tick();
      if (round.reminded + round.escalated > 0) {
        this.logger.log(
          `Recordatorios ${round.reminded}, escalados ${round.escalated}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `No pude hacer el seguimiento: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }

  async tick(now = new Date()): Promise<FollowUpRound> {
    const due = await this.prisma.notification.findMany({
      where: {
        response: null,
        sentAt: {
          lte: new Date(now.getTime() - this.settings.reminderAfterMs),
        },
      },
      select: { projectId: true },
      distinct: ['projectId'],
    });
    let reminded = 0;
    let escalated = 0;
    for (const { projectId } of due) {
      const round = await this.followProject(projectId, now);
      reminded += round.reminded;
      escalated += round.escalated;
    }
    return { reminded, escalated };
  }

  private async admins(projectId: string): Promise<Stakeholder[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project) return [];
    const memberships = await this.prisma.membership.findMany({
      where: { organizationId: project.organizationId, role: 'admin' },
      include: { user: true },
    });
    return memberships.map((membership) => ({
      id: membership.userId,
      name: membership.user.name ?? membership.user.email,
      role: ADMIN_ROLE,
      channel: 'email' as const,
      handle: membership.user.email,
    }));
  }

  private async followProject(
    projectId: string,
    now: Date,
  ): Promise<FollowUpRound> {
    const project = await this.catalogs.load(projectId);
    const admins = await this.admins(projectId);
    return this.uow.run(async (db) => {
      const lake = buildLake(db, project);
      const notification = buildNotification(db, project, {
        extra: admins,
        followUp: this.settings,
      });
      const [proposals, overlaps, notifications] = await Promise.all([
        lake.ports.proposals.list(),
        lake.ports.overlaps.list(),
        notification.listNotifications.execute(),
      ]);
      const followed = await notification.followUpNotices.execute(
        awaitingNotices({ notifications, proposals, overlaps }),
        now,
      );
      const reminded = followed.filter((item) => item.step === 'remind');
      const events: EventDraft[] = reminded.map((item) => ({
        kind: 'notice.reminded',
        message: `Le recordamos a ${project.castName(item.notification.stakeholderId)} que falta su respuesta: ${item.notification.title} (recordatorio ${item.reminders}).`,
        refs: {
          notificationId: item.notification.id,
          castId: item.notification.stakeholderId,
        },
      }));
      const escalations = escalationsOf(project, followed, proposals);
      for (const escalation of escalations) {
        const recipientIds = [
          ...(escalation.authorId ? [escalation.authorId] : []),
          ...admins.map((admin) => admin.id),
        ].filter((id) => escalation.pending.some((item) => item.id !== id));
        await notification.notifyMemo.execute({
          projectId: project.id,
          changeId: escalation.changeId,
          kind: 'escalation',
          memo: escalationMemo(escalation.about, escalation.pending),
          recipientIds,
        });
        events.push({
          kind: 'notice.escalated',
          message: `Escalamos ${escalation.about}: ${escalation.pending.map((item) => item.name).join(', ')} no ${escalation.pending.length === 1 ? 'ha' : 'han'} respondido.`,
          refs: {
            changeId: escalation.changeId,
            castIds: escalation.pending.map((item) => item.id),
          },
        });
      }
      await emitEvents(db, project.id, events);
      return { reminded: reminded.length, escalated: escalations.length };
    });
  }
}
