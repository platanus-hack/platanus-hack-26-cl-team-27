import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/api-db',
  test: {
    name: '@team27/api:db',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['tests-db/**/*.spec.ts'],
    reporters: ['default'],
    fileParallelism: false,
    globalSetup: ['./tests-db/global-setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
}));
