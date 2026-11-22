import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { AccountGuard, CurrentAccount } from './account.guard.ts';
import { type Account, AccountsService, ROLES } from './accounts.service.ts';

const organizationId = z.string().min(1).max(64);

const projectId = z.string().min(1).max(64);

export const projectBody = z.object({
  organizationId,
  name: z.string().trim().min(1).max(120),
  location: z.string().trim().max(200).default(''),
  description: z.string().trim().max(1000).default(''),
});

export const organizationBody = z.object({
  name: z.string().trim().min(1).max(120),
});

const invitationBody = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(ROLES),
});

@Controller()
@UseGuards(AccountGuard)
export class AccountsController {
  private readonly accounts: AccountsService;

  constructor(@Inject(AccountsService) accounts: AccountsService) {
    this.accounts = accounts;
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@CurrentAccount() account: Account) {
    return {
      user: { id: account.id, email: account.email, name: account.name },
      superadmin: account.superadmin,
      organizations: account.memberships.map((item) => ({
        id: item.organizationId,
        name: item.organizationName,
        role: item.role,
      })),
    };
  }

  @Get('projects')
  async projects(@CurrentAccount() account: Account) {
    return { projects: await this.accounts.projects(account) };
  }

  @Post('projects')
  createProject(
    @CurrentAccount() account: Account,
    @Body({ schema: projectBody }) body: z.output<typeof projectBody>,
  ) {
    return this.accounts.createProject(account, body);
  }

  @Get('projects/:projectId')
  @Header('Cache-Control', 'no-store')
  project(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
  ) {
    return this.accounts.project(account, id);
  }

  @Post('organizations')
  async createOrganization(
    @CurrentAccount() account: Account,
    @Body({ schema: organizationBody }) body: z.output<typeof organizationBody>,
  ) {
    const created = await this.accounts.createOrganization(account, body.name);
    return {
      id: created.organizationId,
      name: created.organizationName,
      role: created.role,
    };
  }

  @Delete('organizations/:organizationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOrganization(
    @CurrentAccount() account: Account,
    @Param('organizationId', { schema: organizationId }) id: string,
  ): Promise<void> {
    await this.accounts.deleteOrganization(account, id);
  }

  @Get('organizations/:organizationId/members')
  members(
    @CurrentAccount() account: Account,
    @Param('organizationId', { schema: organizationId }) id: string,
  ) {
    this.accounts.requireMember(account, id);
    return this.accounts.members(id);
  }

  @Post('organizations/:organizationId/invitations')
  invite(
    @CurrentAccount() account: Account,
    @Param('organizationId', { schema: organizationId }) id: string,
    @Body({ schema: invitationBody }) body: z.output<typeof invitationBody>,
  ) {
    this.accounts.requireAdmin(account, id);
    return this.accounts.invite(id, body.email, body.role);
  }
}
