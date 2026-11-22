import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  noticeKindOf,
  noticeRoleOf,
  renderDelivery,
  VISUAL_CID,
  VISUAL_FOCUSES,
  type VisualFocus,
} from '@team27/context-notification';
import type { PrismaClient } from '@team27/data-main';
import type { Response } from 'express';
import { z } from 'zod';

import type { Env } from '../../config/index.ts';
import { AccountGuard, CurrentAccount } from '../accounts/account.guard.ts';
import { type Account, AccountsService } from '../accounts/accounts.service.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import { buildLake } from '../lake/lake.module.ts';
import { modelImager } from '../notification/model-imager.ts';
import { buildNotification } from '../notification/notification.module.ts';
import { ProjectCatalogs } from '../project/project.module.ts';
import { CoordinationService } from './coordination.service.ts';
import { fail } from './http-errors.ts';
import { DEMO_ROLES, findOption, RateLimiter, snap } from './model-roles.ts';

const projectId = z.string().min(1).max(64);

const changeBody = z.object({
  role: z.string().min(1).max(32),
  subject: z.string().min(1).max(64),
  attribute: z.string().min(1).max(64),
  value: z.number().finite(),
});

const imageQuery = z.object({
  focus: z.enum(VISUAL_FOCUSES).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  role: z.string().max(32).optional(),
  shift: z.coerce.number().min(-50).max(50).optional(),
});

const historyQuery = z.object({
  person: z.string().max(64).optional(),
});

const clock = (date: Date): string =>
  date.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/Santiago',
  });

@Controller('projects/:projectId')
@UseGuards(AccountGuard)
export class ModelController {
  private readonly coordination: CoordinationService;
  private readonly catalogs: ProjectCatalogs;
  private readonly accounts: AccountsService;
  private readonly prisma: PrismaClient;
  private readonly baseUrl: string;
  private readonly limiter = new RateLimiter(3_000, 60);
  private versions = 0;

  constructor(
    @Inject(CoordinationService) coordination: CoordinationService,
    @Inject(ProjectCatalogs) catalogs: ProjectCatalogs,
    @Inject(AccountsService) accounts: AccountsService,
    @Inject(PRISMA_CLIENT) prisma: PrismaClient,
    @Inject(ConfigService) config: ConfigService<Env, true>,
  ) {
    this.coordination = coordination;
    this.catalogs = catalogs;
    this.accounts = accounts;
    this.prisma = prisma;
    this.baseUrl = config.get('APP_BASE_URL', { infer: true });
  }

  private async project(account: Account, id: string) {
    await this.accounts.requireProject(account, id);
    return this.catalogs.load(id);
  }

  @Get('model')
  async model(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
  ) {
    const project = await this.project(account, id);
    const baseline = await buildLake(this.prisma, project).ports.baseline.list();
    const current = (subject: string, attribute: string) =>
      baseline.find(
        (entry) => entry.subject === subject && entry.attribute === attribute,
      )?.value ?? null;
    return {
      roles: DEMO_ROLES.filter((role) => project.documentDef(role.documentId)).map(
        (role) => ({
          id: role.id,
          name: role.name,
          emoji: role.emoji,
          color: role.color,
          focus: role.focus,
          summary: role.summary,
          document: project.documentDef(role.documentId)?.name ?? null,
          owner: project.castName(
            project.documentDef(role.documentId)?.ownerId ?? '',
          ),
          options: role.options.map((option) => ({
            ...option,
            current: current(option.subject, option.attribute),
          })),
        }),
      ),
    };
  }

  @Post('model/changes')
  async change(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Body({ schema: changeBody }) body: z.output<typeof changeBody>,
  ) {
    const found = findOption(body.role, body.subject, body.attribute);
    if (!found) {
      throw fail(HttpStatus.BAD_REQUEST, 'unknown_option', 'Esa opción no existe');
    }
    const allowed = this.limiter.check(account.id);
    if (!allowed.ok) {
      throw fail(
        HttpStatus.TOO_MANY_REQUESTS,
        'slow_down',
        `Espera ${Math.ceil(allowed.waitMs / 1000)} s antes del próximo cambio`,
      );
    }
    const project = await this.project(account, id);
    const document = project.documentDef(found.role.documentId);
    if (!document) {
      throw fail(HttpStatus.NOT_FOUND, 'unknown_document', 'El proyecto no tiene ese documento');
    }
    const value = snap(found.option, body.value);
    const now = new Date();
    this.versions += 1;
    const who = account.name ?? account.email.split('@')[0] ?? 'Autodesk';
    const label = `Autodesk v${now.getTime().toString(36).slice(-4)} · ${who}`.slice(0, 64);
    const result = (await this.coordination.ingest({
      project,
      actor: document.ownerId,
      revision: {
        documentId: document.id,
        label,
        spaceId: document.spaceId,
        pointer: `Autodesk Construction Cloud/${project.info.name}/${document.name} (${clock(now)})`,
        claims: [
          {
            subject: found.option.subject,
            attribute: found.option.attribute,
            value,
            unit: found.option.unit,
            role: 'afirma',
            locator: `modelo 3D · ${found.option.label}`,
          },
        ],
      },
      actionId: `model-${account.id}-${now.getTime()}`,
    })) as { proposals?: { changeId?: string | null; title?: string }[] };
    const proposals = result.proposals ?? [];
    return {
      value,
      unit: found.option.unit,
      label,
      changeId: proposals[0]?.changeId ?? null,
      title: proposals[0]?.title ?? null,
      changed: proposals.length > 0,
    };
  }

  @Get('model/image')
  async image(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Query({ schema: imageQuery }) query: z.output<typeof imageQuery>,
    @Res() res: Response,
  ) {
    await this.accounts.requireProject(account, id);
    const role = DEMO_ROLES.find((item) => item.id === query.role);
    const focus: VisualFocus = query.focus ?? role?.focus ?? 'muros';
    const color = query.color ?? role?.color ?? '#256abf';
    const png = await modelImager().image(
      { focus, color, caption: '' },
      query.shift ?? 0,
    );
    if (!png) {
      res.status(404).end();
      return;
    }
    res.setHeader('content-type', 'image/png');
    res.setHeader('cache-control', 'private, max-age=3600');
    res.end(Buffer.from(png));
  }

  @Get('notifications/history')
  async history(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Query({ schema: historyQuery }) query: z.output<typeof historyQuery>,
  ) {
    const project = await this.project(account, id);
    const notification = buildNotification(this.prisma, project);
    const all = await notification.listNotifications.execute(
      query.person ? { stakeholderId: query.person } : {},
    );
    const recent = all.slice(0, 80);
    const deliveries = await notification.listDeliveries.execute(
      recent.map((item) => item.id),
    );
    const people = new Map<string, number>();
    for (const item of all) {
      people.set(item.stakeholderId, (people.get(item.stakeholderId) ?? 0) + 1);
    }
    return {
      people: project.cast.map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role,
        channel: member.channel,
        count: people.get(member.id) ?? 0,
      })),
      notices: recent.map((item) => {
        const rendered = renderDelivery(item, this.baseUrl, 'email');
        const image = rendered.visual
          ? `/api/projects/${encodeURIComponent(project.id)}/model/image?focus=${rendered.visual.focus}&color=${encodeURIComponent(rendered.visual.color)}`
          : null;
        const sent = deliveries
          .filter((delivery) => delivery.notificationId === item.id)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        return {
          id: item.id,
          changeId: item.changeId,
          kind: noticeKindOf(item.context),
          stakeholderId: item.stakeholderId,
          name: project.castName(item.stakeholderId),
          role: item.context?.role ?? null,
          noticeRole: noticeRoleOf(item.context?.role ?? '', item.findings),
          channel: item.channel,
          subject: rendered.subject,
          text: rendered.text,
          html: image
            ? (rendered.html ?? '').replaceAll(`cid:${VISUAL_CID}`, image)
            : rendered.html,
          aiAdded: Boolean(item.context?.suggested),
          whyBy: item.context?.whyBy ?? null,
          sentAt: item.sentAt,
          response: item.response?.kind ?? null,
          delivery: sent
            ? {
                status: sent.status,
                channel: sent.channel,
                reason: sent.reason,
                sentAt: sent.sentAt,
              }
            : null,
        };
      }),
    };
  }
}
