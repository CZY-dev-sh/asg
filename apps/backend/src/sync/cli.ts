import { runJob, syncAll, type SyncJob } from './index.js';
import { closeDb } from '../db/client.js';
import { log } from '../logger.js';

const VALID: SyncJob[] = ['directory', 'idx', 'photos', 'drive-folders', 'fub', 'pipeline', 'marketing'];

async function main() {
  const arg = (process.argv[2] ?? 'all').toLowerCase();
  const mirrorIdx = process.argv.includes('--mirror-idx');

  if (arg === 'all') {
    const results = await syncAll({ mirrorIdx });
    log.info('sync:all complete', results);
  } else if (VALID.includes(arg as SyncJob)) {
    const result = await runJob(arg as SyncJob, { mirrorIdx });
    log.info(`sync:${arg} complete`, result);
  } else {
    log.error(`unknown job "${arg}". valid: all, ${VALID.join(', ')}`);
    process.exitCode = 1;
  }
  await closeDb();
}

main().catch(async (err) => {
  log.error('sync CLI failed', err);
  await closeDb();
  process.exit(1);
});
