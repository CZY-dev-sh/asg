import { runListingMarketingWorker } from './worker.js';
import { closeDb } from '../db/client.js';
import { log } from '../logger.js';

/** Entry point for `npm run agent:work` — claim and process queued jobs once. */
async function main() {
  const maxArg = Number(process.argv[2]);
  const max = Number.isFinite(maxArg) && maxArg > 0 ? maxArg : undefined;
  const processed = await runListingMarketingWorker({ max });
  log.info(`agent:work complete — ${processed} job(s)`);
  await closeDb();
}

main().catch(async (err) => {
  log.error('agent:work failed', err);
  await closeDb();
  process.exit(1);
});
