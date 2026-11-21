import type { Prisma } from '@team27/data-main';

export const toJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;
