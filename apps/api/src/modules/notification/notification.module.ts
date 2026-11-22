import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeliverNotifications,
  GetNotification,
  ListNotifications,
  ListStakeholders,
  NotifyStakeholders,
  ReopenResponse,
  RespondToNotification,
} from '@team27/context-notification';
import {
  GmailEmailSender,
  InMemoryStakeholderDirectory,
  PrismaDeliveryQueue,
  PrismaNotificationRepository,
} from '@team27/context-notification/adapters';
import type { PrismaClient } from '@team27/data-main';

import { provideUseCase } from '../../common/provide-use-case.ts';
import type { Env } from '../../config/index.ts';
import { DELIVER_NOTIFICATIONS, DeliveryWorker } from './delivery.worker.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import type { ProjectCatalog } from '../project/project-catalog.ts';
import { PROJECT_CATALOG } from '../project/project.module.ts';

export const STAKEHOLDER_DIRECTORY = 'STAKEHOLDER_DIRECTORY';
export const NOTIFICATION_REPOSITORY = 'NOTIFICATION_REPOSITORY';

export const buildNotification = (
  db: PrismaClient,
  project: ProjectCatalog,
) => {
  const directory = new InMemoryStakeholderDirectory(project.stakeholders);
  const notifications = new PrismaNotificationRepository(db, project.id);
  return {
    notifyStakeholders: new NotifyStakeholders(directory, notifications),
    listNotifications: new ListNotifications(notifications),
    getNotification: new GetNotification(notifications),
    respondToNotification: new RespondToNotification(notifications),
    reopenResponse: new ReopenResponse(notifications),
  };
};

@Module({
  providers: [
    {
      provide: STAKEHOLDER_DIRECTORY,
      inject: [PROJECT_CATALOG],
      useFactory: (project: ProjectCatalog) =>
        new InMemoryStakeholderDirectory(project.stakeholders),
    },
    {
      provide: NOTIFICATION_REPOSITORY,
      inject: [PRISMA_CLIENT, PROJECT_CATALOG],
      useFactory: (prisma: PrismaClient, project: ProjectCatalog) =>
        new PrismaNotificationRepository(prisma, project.id),
    },
    provideUseCase(NotifyStakeholders, [
      STAKEHOLDER_DIRECTORY,
      NOTIFICATION_REPOSITORY,
    ]),
    provideUseCase(ListNotifications, [NOTIFICATION_REPOSITORY]),
    provideUseCase(GetNotification, [NOTIFICATION_REPOSITORY]),
    provideUseCase(RespondToNotification, [NOTIFICATION_REPOSITORY]),
    provideUseCase(ReopenResponse, [NOTIFICATION_REPOSITORY]),
    provideUseCase(ListStakeholders, [STAKEHOLDER_DIRECTORY]),
    {
      provide: DELIVER_NOTIFICATIONS,
      inject: [ConfigService, PRISMA_CLIENT],
      useFactory: (config: ConfigService<Env, true>, prisma: PrismaClient) => {
        const clientId = config.get('GMAIL_CLIENT_ID', { infer: true });
        const clientSecret = config.get('GMAIL_CLIENT_SECRET', {
          infer: true,
        });
        const refreshToken = config.get('GMAIL_REFRESH_TOKEN', {
          infer: true,
        });
        if (!clientId || !clientSecret || !refreshToken) return null;
        return new DeliverNotifications(
          new PrismaDeliveryQueue(prisma),
          new GmailEmailSender(
            { clientId, clientSecret, refreshToken },
            config.get('EMAIL_FROM', { infer: true }),
          ),
          {
            baseUrl: config.get('APP_BASE_URL', { infer: true }),
            redirectTo: config.get('EMAIL_REDIRECT_TO', { infer: true }),
          },
        );
      },
    },
    DeliveryWorker,
  ],
  exports: [
    NotifyStakeholders,
    ListNotifications,
    GetNotification,
    RespondToNotification,
    ReopenResponse,
    ListStakeholders,
  ],
})
export class NotificationModule {}
