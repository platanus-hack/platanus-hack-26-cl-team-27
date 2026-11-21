import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

const rootEnvFile = fileURLToPath(new URL('../../.env', import.meta.url));

if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
    seed: 'node --env-file-if-exists=../../.env seed/main.ts',
  },
  datasource: { url: process.env['DATABASE_URL'] },
});
