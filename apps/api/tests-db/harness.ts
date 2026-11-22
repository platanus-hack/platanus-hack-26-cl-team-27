import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createPrismaClient, type PrismaClient } from '@team27/data-main';

import { TEST_DATABASE_URL } from './test-database.ts';

export const PRESENTER_KEY = 'clave-de-prueba-sala';

export const PROJECT_ID = 'los-aromos';

export const hasDatabase = TEST_DATABASE_URL !== undefined;

const RUNTIME_TABLES = [
  'changes',
  'impacts',
  'notifications',
  'revisions',
  'chunks',
  'claims',
  'baseline_entries',
  'baseline_history',
  'proposals',
  'reviews',
  'discrepancies',
  'acknowledgements',
  'overlaps',
  'overlap_votes',
  'seats',
  'room_events',
  'room_state',
] as const;

export interface Reply<T = any> {
  readonly status: number;
  readonly body: T;
}

export interface CallOptions {
  readonly token?: string;
  readonly presenter?: boolean;
  readonly actAs?: string;
  readonly actionId?: string;
  readonly body?: unknown;
}

export interface Api {
  readonly app: INestApplication;
  readonly prisma: PrismaClient;
  call<T = any>(
    method: string,
    path: string,
    options?: CallOptions,
  ): Promise<Reply<T>>;
  truncate(options?: { readonly warm?: boolean }): Promise<void>;
  close(): Promise<void>;
}

const clean = async (prisma: PrismaClient, warm: boolean): Promise<void> => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${RUNTIME_TABLES.map((table) => `"${table}"`).join(', ')}`,
  );
  if (warm) {
    await prisma.roomState.create({ data: { projectId: PROJECT_ID } });
  }
};

export const startApi = async (): Promise<Api> => {
  const url = TEST_DATABASE_URL;
  if (!url) throw new Error('Falta TEST_DATABASE_URL');
  process.env['DATABASE_URL'] = url;
  process.env['PRESENTER_KEY'] = PRESENTER_KEY;
  process.env['NODE_ENV'] = 'test';
  process.env['INTEGRATIONS_POLL_SECONDS'] = '0';
  process.env['ANTHROPIC_API_KEY'] = '';
  delete process.env['PROJECT_ID'];
  const prisma = createPrismaClient(url);
  await clean(prisma, true);
  const { AppModule } = await import('../src/app.module.ts');
  const { setupApp } = await import('../src/app.setup.ts');
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = setupApp(
    moduleRef.createNestApplication({
      logger: process.env['TEST_API_LOGS'] ? ['error'] : false,
    }),
  );
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api`;
  const call = async <T = any>(
    method: string,
    path: string,
    options: CallOptions = {},
  ): Promise<Reply<T>> => {
    const headers: Record<string, string> = {};
    if (options.token) headers['x-seat-token'] = options.token;
    if (options.presenter) headers['x-presenter-key'] = PRESENTER_KEY;
    if (options.actAs) headers['x-act-as'] = options.actAs;
    if (options.actionId) headers['x-action-id'] = options.actionId;
    if (options.body !== undefined)
      headers['content-type'] = 'application/json';
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });
    const text = await response.text();
    return {
      status: response.status,
      body: (text === '' ? null : JSON.parse(text)) as T,
    };
  };
  return {
    app,
    prisma,
    call,
    truncate: (options) => clean(prisma, options?.warm ?? true),
    close: async () => {
      await app.close();
      await prisma.$disconnect();
    },
  };
};

export const parallel = <T>(
  count: number,
  work: (index: number) => Promise<T>,
): Promise<T[]> =>
  Promise.all(Array.from({ length: count }, (_, index) => work(index)));

export const countBy = <T>(
  items: readonly T[],
  key: (item: T) => string | number,
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const name = String(key(item));
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
};

export interface Lago {
  readonly seed: readonly unknown[];
  readonly a201C: { authorId: string; body: unknown };
  readonly a201D: { authorId: string; body: unknown };
  readonly is301B: { authorId: string; body: unknown };
}

export const loadLago = (): Lago =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('./fixtures/lago.json', import.meta.url)),
      'utf8',
    ),
  ) as Lago;

export const MINUTE = (minuteId: string) => ({
  minuteId,
  source: 'sala',
  model: { title: 'Estructura N3', discipline: 'estructura' },
  changes: [
    {
      elementId: 'P-12',
      attribute: 'location',
      delta: { dx: 0, dy: 0.4, dz: 0 },
      reason: 'Alinear con el muro de corte M-6',
    },
  ],
});
