// Centralised configuration. All environment reads happen here so the rest of
// the app imports plain, typed values.

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),

  // Postgres connection string. docker-compose provides this; locally it
  // defaults to a dev database.
  databaseUrl: required('DATABASE_URL', 'postgres://ledgerly:ledgerly@localhost:5432/ledgerly'),

  // Secret used to sign the session cookie.
  sessionSecret: required('SESSION_SECRET', 'dev-only-change-me'),

  // The challenge flag. Seeded into the victim's invoice note. In Docker it is
  // injected via the FLAG build arg / env; locally it falls back to the known
  // value so the lab still works end to end.
  flag: required('FLAG', 'FLAG{LEDGERLY_BALANCE_EXPOSED}'),
} as const;
