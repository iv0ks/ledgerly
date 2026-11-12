import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    // The integration test boots the app against an in-memory data layer, so
    // it needs no external Postgres; keep it serial and deterministic.
    fileParallelism: false,
  },
});
