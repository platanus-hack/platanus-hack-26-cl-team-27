import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Redirect,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { AccountGuard, CurrentAccount } from '../accounts/account.guard.ts';
import { type Account, AccountsService } from '../accounts/accounts.service.ts';
import { IntegrationsService } from './integrations.service.ts';
import { guard } from './views.ts';

const uuid = z.uuid();

const projectId = z.string().min(1).max(64);

const linkBody = z.object({
  url: z.string().trim().min(1).max(500),
});

const authorizeBody = z.object({
  projectId: projectId.optional(),
});

const callbackQuery = z.object({
  code: z.string().max(2000).optional(),
  state: z.string().max(200).optional(),
  error: z.string().max(200).optional(),
});

@Controller('integrations')
export class ConnectorsController {
  private readonly integrations: IntegrationsService;
  private readonly accounts: AccountsService;

  constructor(
    @Inject(IntegrationsService) integrations: IntegrationsService,
    @Inject(AccountsService) accounts: AccountsService,
  ) {
    this.integrations = integrations;
    this.accounts = accounts;
  }

  @Get('projects/:projectId')
  @UseGuards(AccountGuard)
  async overview(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) project: string,
  ) {
    await this.accounts.requireProject(account, project);
    return guard(() => this.integrations.overview(account.id, project));
  }

  @Post('google/authorize')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccountGuard)
  async authorize(
    @CurrentAccount() account: Account,
    @Body({ schema: authorizeBody }) body: z.output<typeof authorizeBody>,
  ) {
    if (body.projectId !== undefined) {
      await this.accounts.requireProject(account, body.projectId);
    }
    return guard(async () =>
      this.integrations.authorizationUrl({
        userId: account.id,
        projectId: body.projectId ?? null,
      }),
    );
  }

  @Get('google/callback')
  @Redirect()
  async callback(
    @Query({ schema: callbackQuery }) query: z.output<typeof callbackQuery>,
  ) {
    return { url: await this.integrations.completeAuthorization(query) };
  }

  @Delete('google')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccountGuard)
  disconnect(@CurrentAccount() account: Account) {
    return guard(() => this.integrations.disconnect(account.id));
  }

  @Post('projects/:projectId/sources')
  @UseGuards(AccountGuard)
  async link(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) project: string,
    @Body({ schema: linkBody }) body: z.output<typeof linkBody>,
  ) {
    await this.accounts.requireProject(account, project);
    return guard(() => this.integrations.link(account.id, project, body.url));
  }

  @Post('projects/:projectId/sources/:id/check')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccountGuard)
  async check(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) project: string,
    @Param('id', { schema: uuid }) id: string,
  ) {
    await this.accounts.requireProject(account, project);
    return guard(() => this.integrations.check(project, id));
  }

  @Delete('projects/:projectId/sources/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccountGuard)
  async unlink(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) project: string,
    @Param('id', { schema: uuid }) id: string,
  ) {
    await this.accounts.requireProject(account, project);
    return guard(() => this.integrations.unlink(project, id));
  }
}
