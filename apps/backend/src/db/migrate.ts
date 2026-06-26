import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sql, closeDb } from './client.js';
import { log } from '../logger.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', '..', 'supabase', 'migrations');

/**
 * Lightweight migration runner. For full Supabase workflows prefer the Supabase
 * CLI (`supabase db push`); this exists so the backend can self-migrate against
 * any Postgres connection (CI, a fresh container, etc.).
 */
async function main() {
  await sql`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `;
  const applied = new Set(
    (await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name),
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      log.debug(`skip ${file} (already applied)`);
      continue;
    }
    const text = readFileSync(join(migrationsDir, file), 'utf8');
    log.info(`applying ${file}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx`insert into schema_migrations (name) values (${file})`;
    });
  }
  log.info('migrations complete');
  await closeDb();
}

main().catch(async (err) => {
  log.error('migration failed', err);
  await closeDb();
  process.exit(1);
});
