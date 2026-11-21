import type { Prisma, PrismaClient } from '@team27/data-main';

import type {
  NotificationFilter,
  NotificationRepository,
} from '../../application/ports/NotificationRepository.ts';
import type {
  Notification,
  NotificationDraft,
  NotificationFinding,
  NotificationResponse,
  ResponseKind,
} from '../../domain/Notification.ts';
import type { Channel } from '../../domain/Stakeholder.ts';

type NotificationRow = Prisma.NotificationGetPayload<object>;

const toNotification = (row: NotificationRow): Notification => ({
  id: row.id,
  changeId: row.changeId,
  stakeholderId: row.stakeholderId,
  channel: row.channel as Channel,
  title: row.title,
  findings: row.findings as unknown as NotificationFinding[],
  link: row.link,
  sentAt: row.sentAt,
  response:
    row.response && row.respondedAt
      ? {
          kind: row.response as ResponseKind,
          note: row.responseNote,
          at: row.respondedAt,
        }
      : null,
});

export class PrismaNotificationRepository implements NotificationRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async saveMany(
    drafts: readonly NotificationDraft[],
  ): Promise<Notification[]> {
    const rows = await this.prisma.$transaction(
      drafts.map((draft) =>
        this.prisma.notification.create({
          data: {
            changeId: draft.changeId,
            stakeholderId: draft.stakeholderId,
            channel: draft.channel,
            title: draft.title,
            findings: draft.findings as unknown as Prisma.InputJsonValue,
            link: draft.link,
          },
        }),
      ),
    );
    return rows.map(toNotification);
  }

  async list(filter: NotificationFilter): Promise<Notification[]> {
    const rows = await this.prisma.notification.findMany({
      where: {
        ...(filter.changeIds
          ? { changeId: { in: [...filter.changeIds] } }
          : {}),
        ...(filter.stakeholderId
          ? { stakeholderId: filter.stakeholderId }
          : {}),
      },
      orderBy: { sentAt: 'desc' },
    });
    return rows.map(toNotification);
  }

  async respond(
    id: string,
    response: NotificationResponse,
  ): Promise<Notification | null> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id },
      data: {
        response: response.kind,
        responseNote: response.note,
        respondedAt: response.at,
      },
    });
    if (count === 0) return null;
    const row = await this.prisma.notification.findUnique({ where: { id } });
    return row ? toNotification(row) : null;
  }

  async clearResponse(id: string): Promise<Notification | null> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id },
      data: { response: null, responseNote: null, respondedAt: null },
    });
    if (count === 0) return null;
    return this.findById(id);
  }

  async findById(id: string): Promise<Notification | null> {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    return row ? toNotification(row) : null;
  }
}
