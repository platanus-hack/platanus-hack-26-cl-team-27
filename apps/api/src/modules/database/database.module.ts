import {
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPrismaClient, type PrismaClient } from '@team27/data-main';

import type { Env } from '../../config/index.ts';
import { PRISMA_CLIENT } from './prisma-token.ts';
import { UnitOfWork } from './unit-of-work.ts';

export { PRISMA_CLIENT };

@Global()
@Module({
  providers: [
    {
      provide: PRISMA_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createPrismaClient(config.get('DATABASE_URL', { infer: true })),
    },
    UnitOfWork,
  ],
  exports: [PRISMA_CLIENT, UnitOfWork],
})
export class DatabaseModule implements OnApplicationShutdown {
  private readonly prisma: PrismaClient;

  constructor(@Inject(PRISMA_CLIENT) prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
