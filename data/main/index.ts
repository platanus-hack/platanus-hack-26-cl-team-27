import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client.ts';

export * from './generated/prisma/client.ts';
export type * from './project/definition.ts';
export {
  listProjectIds,
  loadProjectDefinition,
  saveProjectDefinition,
} from './project/store.ts';

export const createPrismaClient = (connectionString: string): PrismaClient =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
