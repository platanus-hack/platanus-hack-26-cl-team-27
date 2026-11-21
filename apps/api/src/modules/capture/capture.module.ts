import { Module } from '@nestjs/common';
import {
  GetChange,
  GetLatestSnapshot,
  ListChanges,
  PublishVersion,
} from '@team27/context-capture';
import {
  PrismaChangeRepository,
  PrismaSnapshotRepository,
} from '@team27/context-capture/adapters';
import type { PrismaClient } from '@team27/data-main';

import { provideUseCase } from '../../common/provide-use-case.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';

export const SNAPSHOT_REPOSITORY = 'SNAPSHOT_REPOSITORY';
export const CHANGE_REPOSITORY = 'CHANGE_REPOSITORY';

@Module({
  providers: [
    {
      provide: SNAPSHOT_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) =>
        new PrismaSnapshotRepository(prisma),
    },
    {
      provide: CHANGE_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) => new PrismaChangeRepository(prisma),
    },
    provideUseCase(PublishVersion, [SNAPSHOT_REPOSITORY, CHANGE_REPOSITORY]),
    provideUseCase(GetLatestSnapshot, [SNAPSHOT_REPOSITORY]),
    provideUseCase(ListChanges, [CHANGE_REPOSITORY]),
    provideUseCase(GetChange, [CHANGE_REPOSITORY]),
  ],
  exports: [PublishVersion, GetLatestSnapshot, ListChanges, GetChange],
})
export class CaptureModule {}
