import { Module } from '@nestjs/common';
import {
  ListNotifications,
  ListStakeholders,
  NotifyStakeholders,
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
import { NotificationController } from './notification.controller.ts';

export const STAKEHOLDER_DIRECTORY = 'STAKEHOLDER_DIRECTORY';
export const NOTIFICATION_REPOSITORY = 'NOTIFICATION_REPOSITORY';

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
    provideUseCase(RespondToNotification, [NOTIFICATION_REPOSITORY]),
    provideUseCase(ListStakeholders, [STAKEHOLDER_DIRECTORY]),
  ],
  controllers: [NotificationController],
  exports: [NotifyStakeholders, ListNotifications, ListStakeholders],
})
export class NotificationModule {}
