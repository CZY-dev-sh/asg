import { sql, j } from '../db/client.js';
import { log } from '../logger.js';

export interface SyncResult {
  source: string;
  records: number;
  meta?: Record<string, unknown>;
}

/**
 * In-process "is this source already running" guard. Cron schedules fire on a
 * fixed clock regardless of whether the previous run finished — without this,
 * tightening a job's interval below its own typical run time (e.g. `fub`
 * currently takes ~3-4 minutes end to end) would launch overlapping runs that
 * multiply load on the source API and the DB at once. This only protects a
 * single process; it's not a cross-instance lock.
 */
const inFlight = new Set<string>();

/**
 * Wrap a sync job: skip if already running, record a row in sync_runs, time
 * it, capture errors. Returns the result (or a structured error) without
 * throwing, so the orchestrator can run every source even if one fails.
 */
export async function runSync(
  source: string,
  job: () => Promise<SyncResult>,
): Promise<{ ok: boolean; source: string; records: number; error?: string; ms: number }> {
  if (inFlight.has(source)) {
    log.warn(`sync:${source} skipped — previous run is still in progress`);
    return { ok: false, source, records: 0, error: 'skipped: previous run still in progress', ms: 0 };
  }
  inFlight.add(source);
  const started = Date.now();
  try {
    const [run] = await sql<{ id: string }[]>`
      insert into sync_runs (source, status) values (${source}, 'running') returning id
    `;
    const runId = run!.id;
    try {
      log.info(`sync:${source} started`);
      const result = await job();
      const ms = Date.now() - started;
      await sql`
        update sync_runs set status = 'ok', finished_at = now(),
          records = ${result.records}, meta = ${j(result.meta ?? {})}
        where id = ${runId}
      `;
      log.info(`sync:${source} ok — ${result.records} records in ${ms}ms`);
      return { ok: true, source, records: result.records, ms };
    } catch (err) {
      const ms = Date.now() - started;
      const message = err instanceof Error ? err.message : String(err);
      await sql`
        update sync_runs set status = 'error', finished_at = now(), error = ${message}
        where id = ${runId}
      `;
      log.error(`sync:${source} failed in ${ms}ms: ${message}`);
      return { ok: false, source, records: 0, error: message, ms };
    }
  } finally {
    inFlight.delete(source);
  }
}
