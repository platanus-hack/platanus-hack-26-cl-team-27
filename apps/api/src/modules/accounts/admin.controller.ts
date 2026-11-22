import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { AccountGuard, CurrentAccount } from './account.guard.ts';
import { type Account, AccountsService, ROLES } from './accounts.service.ts';
import { AdminService } from './admin.service.ts';

const organizationBody = z.object({
  name: z.string().trim().min(2).max(120),
});

const invitationBody = z.object({
  email: z.string().trim().email().max(254),
  organizationId: z.string().min(1).max(64),
  role: z.enum(ROLES),
});

@Controller('admin')
@UseGuards(AccountGuard)
export class AdminController {
  private readonly accounts: AccountsService;
  private readonly admin: AdminService;

  constructor(
    @Inject(AccountsService) accounts: AccountsService,
    @Inject(AdminService) admin: AdminService,
  ) {
    this.accounts = accounts;
    this.admin = admin;
  }

  @Get('users')
  @Header('Cache-Control', 'no-store')
  users(@CurrentAccount() account: Account) {
    this.accounts.requireSuperadmin(account);
    return this.admin.users();
  }

  @Get('organizations')
  @Header('Cache-Control', 'no-store')
  organizations(@CurrentAccount() account: Account) {
    this.accounts.requireSuperadmin(account);
    return this.admin.organizations();
  }

  @Post('organizations')
  createOrganization(
    @CurrentAccount() account: Account,
    @Body({ schema: organizationBody })
    body: z.output<typeof organizationBody>,
  ) {
    this.accounts.requireSuperadmin(account);
    return this.admin.createOrganization(body.name);
  }

  @Post('invitations')
  invite(
    @CurrentAccount() account: Account,
    @Body({ schema: invitationBody }) body: z.output<typeof invitationBody>,
  ) {
    this.accounts.requireSuperadmin(account);
    return this.admin.invite(body.organizationId, body.email, body.role);
  }
}
