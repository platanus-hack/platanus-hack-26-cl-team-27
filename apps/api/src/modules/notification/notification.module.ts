import {
  GetNotification,
  ListNotifications,
  NotifyStakeholders,
  ReopenResponse,
  RespondToNotification,
} from '@team27/context-notification';
import {
  InMemoryStakeholderDirectory,
  PrismaNotificationRepository,
} from '@team27/context-notification/adapters';
import type { PrismaClient } from '@team27/data-main';

import type { ProjectCatalog } from '../project/project-catalog.ts';

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
