import { seedBrandGuidelines } from './brand.js';
import { closeDb } from '../db/client.js';
import { log } from '../logger.js';

/** Entry point for `npm run brand:seed` — upsert the canonical ASG brand guide. */
async function main() {
  await seedBrandGuidelines();
  log.info('brand:seed complete');
  await closeDb();
}

main().catch(async (err) => {
  log.error('brand:seed failed', err);
  await closeDb();
  process.exit(1);
});
