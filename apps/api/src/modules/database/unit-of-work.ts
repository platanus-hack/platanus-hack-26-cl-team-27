import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@team27/data-main';

import { PRISMA_CLIENT } from './prisma-token.ts';

const ROOM_LOCK = 2_700_001;

const TRANSACTION_OPTIONS = { timeout: 30_000, maxWait: 10_000 };

const READ_OPTIONS = {
  ...TRANSACTION_OPTIONS,
  isolationLevel: 'RepeatableRead' as const,
};

const asClient = (tx: Prisma.TransactionClient): PrismaClient => {
  const client: PrismaClient = new Proxy(tx, {
    get(target, property) {
      if (property === '$transaction') {
        return async (operations: unknown) => {
          if (typeof operations === 'function') {
            return (operations as (db: PrismaClient) => Promise<unknown>)(
              client,
            );
          }
          const results: unknown[] = [];
          for (const operation of operations as PromiseLike<unknown>[]) {
            results.push(await operation);
          }
          return results;
        };
      }
      const value = Reflect.get(target, property) as unknown;
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  }) as unknown as PrismaClient;
  return client;
};

@Injectable()
export class UnitOfWork {
  private readonly prisma: PrismaClient;

  constructor(@Inject(PRISMA_CLIENT) prisma: PrismaClient) {
    this.prisma = prisma;
  }

  run<T>(work: (db: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${ROOM_LOCK}::bigint)::text AS locked`;
      return work(asClient(tx));
    }, TRANSACTION_OPTIONS);
  }

  read<T>(work: (db: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return work(asClient(tx));
    }, READ_OPTIONS);
  }
}
