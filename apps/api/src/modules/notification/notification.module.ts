import { Module } from '@nestjs/common';
import {
  GetNotification,
  ListNotifications,
  ListStakeholders,
  NotifyStakeholders,
  ReopenResponse,
  RespondToNotification,
} from '@team27/context-notification';
import {
  InMemoryStakeholderDirectory,
  PrismaNotificationRepository,
} from '@team27/context-notification/adapters';
import type { PrismaClient } from '@team27/data-main';

import { provideUseCase } from '../../common/provide-use-case.ts';
import { LOS_AROMOS } from '../../scenario/los-aromos.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';

export const STAKEHOLDER_DIRECTORY = 'STAKEHOLDER_DIRECTORY';
export const NOTIFICATION_REPOSITORY = 'NOTIFICATION_REPOSITORY';

export const buildNotification = (db: PrismaClient) => {
  const directory = new InMemoryStakeholderDirectory(LOS_AROMOS.stakeholders);
  const notifications = new PrismaNotificationRepository(db);
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
      useFactory: () =>
        new InMemoryStakeholderDirectory(LOS_AROMOS.stakeholders),
    },
    {
      provide: NOTIFICATION_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) =>
        new PrismaNotificationRepository(prisma),
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
