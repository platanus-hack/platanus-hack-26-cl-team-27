import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/aps',
  test: {
    name: '@team27/aps',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
