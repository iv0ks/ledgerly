// Applies pending SQL migrations from ./drizzle, then exits.
// Run by `pnpm db:migrate` and by the container entrypoint on startup.
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, sql } from './client.js';

async function main(): Promise<void> {
  console.log('[migrate] applying migrations from ./drizzle …');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[migrate] done.');
  await sql.end();
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
