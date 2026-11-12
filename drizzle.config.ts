import { defineConfig } from 'drizzle-kit';

// Drizzle Kit configuration. `pnpm db:generate` reads the schema and emits SQL
// migrations into ./drizzle, which are applied at startup by src/db/migrate.ts.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://ledgerly:ledgerly@localhost:5432/ledgerly',
  },
  strict: true,
  verbose: true,
});
