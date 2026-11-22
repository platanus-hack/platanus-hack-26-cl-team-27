import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  createPrismaClient,
  saveOrganization,
  saveProjectDefinition,
} from '@team27/data-main';
import { LOS_AROMOS, LOS_AROMOS_ORGANIZATION } from '@team27/data-main/seed';

import {
  TEST_DATABASE_URL,
  adminUrl,
  assertTestDatabase,
} from './test-database.ts';

const run = promisify(execFile);

const DATA_MAIN = fileURLToPath(new URL('../../../data/main', import.meta.url));

const recreate = async (url: string, name: string): Promise<void> => {
  const admin = createPrismaClient(adminUrl(url));
  try {
    await admin.$executeRawUnsafe(
      `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`,
    );
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.$disconnect();
  }
};

const seed = async (url: string): Promise<void> => {
  const prisma = createPrismaClient(url);
  try {
    await saveOrganization(prisma, LOS_AROMOS_ORGANIZATION);
    await saveProjectDefinition(prisma, LOS_AROMOS);
  } finally {
    await prisma.$disconnect();
  }
};

export default async function setup(): Promise<void> {
  if (!TEST_DATABASE_URL) {
    console.warn(
      '\nTEST_DATABASE_URL no está definida: se saltan los tests contra Postgres. ' +
        'Ejemplo: TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5427/team27_test\n',
    );
    return;
  }
  const name = assertTestDatabase(TEST_DATABASE_URL);
  await recreate(TEST_DATABASE_URL, name);
  await run('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: DATA_MAIN,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
  await seed(TEST_DATABASE_URL);
}
