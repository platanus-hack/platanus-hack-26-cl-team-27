import { Module } from '@nestjs/common';
import { DetectChanges, GetChange, ListChanges } from '@team27/context-capture';
import { PrismaChangeRepository } from '@team27/context-capture/adapters';
import type { PrismaClient } from '@team27/data-main';

import { provideUseCase } from '../../common/provide-use-case.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';

export const CHANGE_REPOSITORY = 'CHANGE_REPOSITORY';

export const buildCapture = (db: PrismaClient) => {
  const changes = new PrismaChangeRepository(db);
  return {
    detectChanges: new DetectChanges(changes),
    listChanges: new ListChanges(changes),
    getChange: new GetChange(changes),
  };
};

@Module({
  providers: [
    {
      provide: CHANGE_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) => new PrismaChangeRepository(prisma),
    },
    provideUseCase(DetectChanges, [CHANGE_REPOSITORY]),
    provideUseCase(ListChanges, [CHANGE_REPOSITORY]),
    provideUseCase(GetChange, [CHANGE_REPOSITORY]),
  ],
  exports: [DetectChanges, ListChanges, GetChange],
})
export class CaptureModule {}
