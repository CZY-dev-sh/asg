import { runSync } from '../sync/runner.js';
import { syncDirectory } from '../sync/directory.js';
import { closeDb } from './client.js';
import { log } from '../logger.js';

/** Seed the agents directory from the canonical roster. */
async function main() {
  const result = await runSync('directory', syncDirectory);
  log.info('seed complete', result);
  await closeDb();
}

main().catch(async (err) => {
  log.error('seed failed', err);
  await closeDb();
  process.exit(1);
});
