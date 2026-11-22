import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { AccountGuard, CurrentAccount } from './account.guard.ts';
import { type Account, AccountsService, ROLES } from './accounts.service.ts';

const organizationId = z.string().min(1).max(64);

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
