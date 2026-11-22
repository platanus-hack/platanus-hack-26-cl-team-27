import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/index.ts';
import { AccountGuard } from './account.guard.ts';
import { AccountsController } from './accounts.controller.ts';
import { AccountsService, IDENTITY, SUPERADMINS } from './accounts.service.ts';
import { AdminController } from './admin.controller.ts';
import { AdminService } from './admin.service.ts';
import { Auth0Identity } from './identity.ts';

@Module({
  controllers: [AccountsController, AdminController],
  providers: [
    {
      provide: IDENTITY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const domain = config.get('AUTH0_DOMAIN', { infer: true });
        const audience = config.get('AUTH0_AUDIENCE', { infer: true });
        return domain && audience
          ? new Auth0Identity({ domain, audience })
          : null;
      },
    },
    {
      provide: SUPERADMINS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get('SUPERADMIN_EMAILS', { infer: true }),
    },
    AccountsService,
    AdminService,
    AccountGuard,
  ],
  exports: [AccountsService, AccountGuard],
})
export class AccountsModule {}
