import { have } from '../env.js';
import { runSync } from './runner.js';
import { syncDirectory } from './directory.js';
import { syncIdx } from './idx.js';
import { syncPhotos, syncDriveFolders } from './photos.js';
import { syncFub } from './fub.js';
import { syncPipeline } from './pipeline.js';
import { syncMarketing } from './marketing.js';

export type SyncJob =
  | 'directory'
  | 'idx'
  | 'photos'
  | 'drive-folders'
  | 'fub'
  | 'pipeline'
  | 'marketing';

export async function runJob(job: SyncJob, opts: { mirrorIdx?: boolean } = {}) {
  switch (job) {
    case 'directory':
      return runSync('directory', syncDirectory);
    case 'idx':
      return runSync('idx', syncIdx);
    case 'photos':
      return runSync('photos', () => syncPhotos({ mirrorIdx: opts.mirrorIdx }));
    case 'drive-folders':
      return runSync('drive-folders', syncDriveFolders);
    case 'fub':
      return runSync('fub', syncFub);
    case 'pipeline':
      return runSync('pipeline', syncPipeline);
    case 'marketing':
      return runSync('marketing', syncMarketing);
  }
}

/**
 * Run all configured sources in dependency order:
 *   directory → idx → photos/drive-folders → fub → pipeline → marketing
 * Skips sources without credentials so a partial config still works.
 */
export async function syncAll(opts: { mirrorIdx?: boolean } = {}) {
  const results = [];
  results.push(await runJob('directory'));
  if (have.idx()) results.push(await runJob('idx'));
  if (have.drive() && have.supabaseStorage()) {
    results.push(await runJob('photos', opts));
    results.push(await runJob('drive-folders'));
  }
  if (have.fub()) results.push(await runJob('fub'));
  results.push(await runJob('pipeline'));
  if (have.asana() || have.acuity()) results.push(await runJob('marketing'));
  return results;
}
