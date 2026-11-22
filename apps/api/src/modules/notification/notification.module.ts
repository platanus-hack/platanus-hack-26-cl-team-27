import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AnswerConflictNotice,
  AttachClashes,
  AttachReasons,
  DEFAULT_FOLLOW_UP,
  DeliverNotifications,
  type FollowUpSettings,
  FollowUpNotices,
  GetNotification,
  ListDeliveries,
  ListNotifications,
  NotifyConflict,
  NotifyMemo,
  NotifyStakeholders,
  ReopenResponse,
  RespondToNotification,
  type Stakeholder,
} from '@team27/context-notification';
import {
  InMemoryStakeholderDirectory,
  PrismaDeliveryQueue,
  PrismaNotificationRepository,
} from '@team27/context-notification/adapters';
import type { PrismaClient } from '@team27/data-main';

import type { Env } from '../../config/index.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import type { ProjectCatalog } from '../project/project-catalog.ts';
import { buildChannelSenders } from './channel-senders.ts';
import { modelImager } from './model-imager.ts';
import { DELIVER_NOTIFICATIONS, DeliveryWorker } from './delivery.worker.ts';

export interface NotificationOptions {
  readonly extra?: readonly Stakeholder[];
  readonly followUp?: FollowUpSettings;
}

export const buildNotification = (
  db: PrismaClient,
  project: ProjectCatalog,
  options: NotificationOptions = {},
) => {
  const directory = new InMemoryStakeholderDirectory(project.stakeholders);
  const notifications = new PrismaNotificationRepository(db, project.id);
  const queue = new PrismaDeliveryQueue(db);
  return {
    notifyMemo: new NotifyMemo(
      new InMemoryStakeholderDirectory([
        ...project.cast,
        ...(options.extra ?? []),
      ]),
      notifications,
    ),
    answerConflictNotice: new AnswerConflictNotice(notifications),
    followUpNotices: new FollowUpNotices(
      notifications,
      queue,
      options.followUp ?? DEFAULT_FOLLOW_UP,
    ),
    notifyStakeholders: new NotifyStakeholders(directory, notifications),
    notifyConflict: new NotifyConflict(
      new InMemoryStakeholderDirectory(project.cast),
      notifications,
    ),
    attachClashes: new AttachClashes(notifications),
    attachReasons: new AttachReasons(notifications),
    listNotifications: new ListNotifications(notifications),
    listDeliveries: new ListDeliveries(queue),
    getNotification: new GetNotification(notifications),
    respondToNotification: new RespondToNotification(notifications),
    reopenResponse: new ReopenResponse(notifications),
  };
};

@Module({
  providers: [
    {
      provide: DELIVER_NOTIFICATIONS,
      inject: [ConfigService, PRISMA_CLIENT],
      useFactory: (config: ConfigService<Env, true>, prisma: PrismaClient) => {
        const senders = buildChannelSenders({
          gmailClientId: config.get('GMAIL_CLIENT_ID', { infer: true }),
          gmailClientSecret: config.get('GMAIL_CLIENT_SECRET', {
            infer: true,
          }),
          gmailRefreshToken: config.get('GMAIL_REFRESH_TOKEN', {
            infer: true,
          }),
          emailFrom: config.get('EMAIL_FROM', { infer: true }),
          slackWebhookUrl: config.get('SLACK_WEBHOOK_URL', { infer: true }),
          teamsWebhookUrl: config.get('TEAMS_WEBHOOK_URL', { infer: true }),
          imager: modelImager(),
        });
        if (Object.keys(senders).length === 0) return null;
        const emailRedirect = config.get('EMAIL_REDIRECT_TO', { infer: true });
        return new DeliverNotifications(
          new PrismaDeliveryQueue(prisma),
          senders,
          {
            baseUrl: config.get('APP_BASE_URL', { infer: true }),
            redirects: emailRedirect ? { email: emailRedirect } : {},
          },
        );
      },
    },
    DeliveryWorker,
  ],
})
export class NotificationDeliveryModule {}
