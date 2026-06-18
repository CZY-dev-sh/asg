import cron from 'node-cron';
import { env, have } from './env.js';
import { runJob } from './sync/index.js';
import { log } from './logger.js';

/** Register cron jobs that keep Supabase in sync with every source. */
export function startScheduler(): void {
  if (!env.ENABLE_SCHEDULER) {
    log.info('scheduler disabled (set ENABLE_SCHEDULER=true to enable in-process syncs)');
    return;
  }

  const schedule = (expr: string, name: string, fn: () => Promise<unknown>) => {
    if (!cron.validate(expr)) {
      log.warn(`invalid cron "${expr}" for ${name} — skipping`);
      return;
    }
    cron.schedule(expr, () => {
      fn().catch((err) => log.error(`scheduled ${name} failed`, err));
    });
    log.info(`scheduled ${name} (${expr})`);
  };

  if (have.idx()) schedule(env.CRON_IDX, 'idx', () => runJob('idx'));
  if (have.drive() && have.supabaseStorage()) {
    schedule(env.CRON_PHOTOS, 'photos', () => runJob('photos'));
  }
  if (have.fub()) schedule(env.CRON_FUB, 'fub', () => runJob('fub'));
  schedule(env.CRON_PIPELINE, 'pipeline', () => runJob('pipeline'));
  schedule(env.CRON_DIRECTORY, 'directory', () => runJob('directory'));
  if (have.asana() || have.acuity() || have.acuityIcs())
    schedule(env.CRON_MARKETING, 'marketing', () => runJob('marketing'));
}
