import { sql, j } from '../db/client.js';
import { log } from '../logger.js';

export interface SyncResult {
  source: string;
  records: number;
  meta?: Record<string, unknown>;
}

/**
 * Wrap a sync job: record a row in sync_runs, time it, capture errors. Returns
 * the result (or a structured error) without throwing, so the orchestrator can
 * run every source even if one fails.
 */
export async function runSync(
  source: string,
  job: () => Promise<SyncResult>,
): Promise<{ ok: boolean; source: string; records: number; error?: string; ms: number }> {
  const started = Date.now();
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
}
