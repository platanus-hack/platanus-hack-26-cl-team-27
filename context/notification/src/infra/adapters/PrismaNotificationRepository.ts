import type { Prisma, PrismaClient } from '@team27/data-main';

import type {
  NotificationFilter,
  NotificationRepository,
} from '../../application/ports/NotificationRepository.ts';
import {
  type NoticeClash,
  type NoticeContext,
  noticeKindOf,
} from '../../domain/Notice.ts';
import {
  isChangeNotice,
  type Notification,
  type NotificationDraft,
  type NotificationFinding,
  type NotificationResponse,
  type ResponseKind,
  withClashes,
} from '../../domain/Notification.ts';
import type { Channel } from '../../domain/Stakeholder.ts';

type NotificationRow = Prisma.NotificationGetPayload<object>;

export const toNotification = (row: NotificationRow): Notification => ({
  id: row.id,
  changeId: row.changeId,
  stakeholderId: row.stakeholderId,
  channel: row.channel as Channel,
  title: row.title,
  findings: row.findings as unknown as NotificationFinding[],
  link: row.link,
  context: (row.context as unknown as NoticeContext | null) ?? null,
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
  private readonly projectId: string;

  constructor(prisma: PrismaClient, projectId: string) {
    this.prisma = prisma;
    this.projectId = projectId;
  }

  async saveMany(
    drafts: readonly NotificationDraft[],
  ): Promise<Notification[]> {
    const now = new Date();
    const rows = await this.prisma.$transaction(
      drafts.map((draft) =>
        this.prisma.notification.create({
          data: {
            projectId: this.projectId,
            changeId: draft.changeId,
            stakeholderId: draft.stakeholderId,
            channel: draft.channel,
            title: draft.title,
            findings: draft.findings as unknown as Prisma.InputJsonValue,
            link: draft.link,
            ...(draft.context
              ? { context: draft.context as unknown as Prisma.InputJsonValue }
              : {}),
            deliveries: {
              create: {
                projectId: this.projectId,
                channel: 'email',
                recipient: draft.email,
                nextAttemptAt: now,
                createdAt: now,
              },
            },
          },
        }),
      ),
    );
    return rows.map(toNotification);
  }

  async list(filter: NotificationFilter): Promise<Notification[]> {
    const rows = await this.prisma.notification.findMany({
      where: {
        projectId: this.projectId,
        ...(filter.changeIds
          ? { changeId: { in: [...filter.changeIds] } }
          : {}),
        ...(filter.stakeholderId
          ? { stakeholderId: filter.stakeholderId }
          : {}),
      },
      orderBy: { sentAt: 'desc' },
    });
    const { kind } = filter;
    return rows
      .map(toNotification)
      .filter(
        (notification) =>
          kind === undefined || noticeKindOf(notification.context) === kind,
      );
  }

  async respond(
    id: string,
    response: NotificationResponse,
  ): Promise<Notification | null> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, projectId: this.projectId },
      data: {
        response: response.kind,
        responseNote: response.note,
        respondedAt: response.at,
      },
    });
    if (count === 0) return null;
    const row = await this.prisma.notification.findUnique({
      where: { id, projectId: this.projectId },
    });
    return row ? toNotification(row) : null;
  }

  async clearResponse(id: string): Promise<Notification | null> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, projectId: this.projectId },
      data: { response: null, responseNote: null, respondedAt: null },
    });
    if (count === 0) return null;
    return this.findById(id);
  }

  async findById(id: string): Promise<Notification | null> {
    const row = await this.prisma.notification.findUnique({
      where: { id, projectId: this.projectId },
    });
    return row ? toNotification(row) : null;
  }

  async setClashes(
    changeId: string,
    clashes: readonly NoticeClash[],
  ): Promise<number> {
    const rows = await this.prisma.notification.findMany({
      where: { projectId: this.projectId, changeId },
    });
    const changeRows = rows.filter((row) =>
      isChangeNotice(toNotification(row)),
    );
    for (const row of changeRows) {
      await this.prisma.notification.update({
        where: { id: row.id },
        data: {
          context: withClashes(
            row.context as unknown as NoticeContext | null,
            clashes,
          ) as unknown as Prisma.InputJsonValue,
        },
      });
    }
    return changeRows.length;
  }
}
