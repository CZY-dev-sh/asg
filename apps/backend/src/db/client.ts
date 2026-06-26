import postgres from 'postgres';
import { env } from '../env.js';

/**
 * Single Postgres connection pool to Supabase. We talk to Postgres directly
 * (rather than PostgREST) so the serving views and multi-table joins are easy.
 * The service-role/database credentials bypass RLS; this pool must never be
 * reachable from the browser.
 */
export const sql = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === 'production' ? 10 : 4,
  idle_timeout: 30,
  connect_timeout: 30,
  prepare: false, // compatible with Supabase transaction pooler (pgbouncer)
  transform: { undefined: null },
});

export type Sql = typeof sql;

/** Wrap an arbitrary value as a JSONB parameter (loosens postgres.js typing). */
export function j(value: unknown) {
  return sql.json(value as Parameters<typeof sql.json>[0]);
}

export async function pingDb(): Promise<boolean> {
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  }
}

export async function closeDb(): Promise<void> {
  await sql.end({ timeout: 5 });
}
