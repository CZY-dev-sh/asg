import { sql, j } from '../db/client.js';
import { have } from '../env.js';
import { log } from '../logger.js';
import { TokenCeilingError } from '../connectors/anthropic.js';
import {
  claimNextJob,
  markJobRunning,
  recordJobUsage,
  finishJob,
  writeDraft,
  type MarketingJob,
} from '../repositories/listingMarketing.js';
import { runListingMarketingAgent, NoGroundingError } from './orchestrator.js';

/**
 * Listing marketing worker. Claims queued jobs and drafts an on-brand,
 * Fair-Housing-compliant marketing package for HUMAN review. Drafts only —
 * nothing here publishes to the site, FUB, or MLS.
 *
 * The compliance gate that marks a draft "ready" arrives in M3; for now drafts
 * are written with compliance_passed = false.
 *
 * Returns the number of jobs processed.
 */
export async function runListingMarketingWorker(opts: { max?: number } = {}): Promise<number> {
  if (!have.anthropic()) {
    log.info('agent:work skipped — ANTHROPIC_API_KEY not configured');
    return 0;
  }

  const max = opts.max ?? 10;
  let processed = 0;

  for (let i = 0; i < max; i++) {
    const job = await claimNextJob();
    if (!job) break;
    await processJob(job);
    processed++;
  }

  log.info(`agent:work processed ${processed} job(s)`);
  return processed;
}

async function processJob(job: MarketingJob): Promise<void> {
  const { id: jobId, listing_id: listingId } = job;
  log.info(`agent:work running job ${jobId} (listing ${listingId}, attempt ${job.attempts})`);

  try {
    await markJobRunning(jobId);
    const result = await runListingMarketingAgent(listingId);

    const aggUsage = result.usageByStep.reduce(
      (acc, s) => ({
        input: acc.input + s.usage.inputTokens,
        output: acc.output + s.usage.outputTokens,
      }),
      { input: 0, output: 0 },
    );
    await recordJobUsage(jobId, {
      model: result.models.copy,
      inputTokens: aggUsage.input,
      outputTokens: aggUsage.output,
      totalTokens: result.totalTokens,
      estimatedCostUsd: result.estimatedCostUsd,
    });

    const draft = await writeDraft({
      listingId,
      jobId,
      mlsDescription: result.pkg.mlsDescription,
      socialCaptions: result.pkg.socialCaptions,
      emailBlast: result.pkg.emailBlast,
      factSheet: result.pkg.factSheet as unknown as Record<string, unknown>,
      contentPillar: result.pkg.contentPillar,
      assets: { unverifiedClaims: result.facts.unverifiedClaims },
      compliancePassed: false,
    });

    await sql`
      insert into listing_activity (listing_id, type, label, actor, meta, client_visible)
      values (
        ${listingId}::uuid, 'marketing_drafts_ready', 'Marketing drafts ready for review', 'Marketing agent',
        ${j({ draftId: draft.id, version: draft.version, contentPillar: result.pkg.contentPillar, estimatedCostUsd: result.estimatedCostUsd })},
        false
      )
    `;

    await finishJob(jobId, 'succeeded', {
      meta: { draftId: draft.id, version: draft.version, totalTokens: result.totalTokens, estimatedCostUsd: result.estimatedCostUsd },
    });
    log.info(`agent:work job ${jobId} succeeded — draft v${draft.version} (${result.totalTokens} tok, $${result.estimatedCostUsd.toFixed(4)})`);
  } catch (err) {
    if (err instanceof NoGroundingError) {
      log.warn(`agent:work job ${jobId} skipped — no grounding`);
      await finishJob(jobId, 'skipped', { meta: { reason: 'no_grounding' } });
      return;
    }
    if (err instanceof TokenCeilingError) {
      log.error(`agent:work job ${jobId} aborted — ${err.message}`);
      await finishJob(jobId, 'failed', { error: err.message, meta: { reason: 'token_ceiling', used: err.used, limit: err.limit } });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    log.error(`agent:work job ${jobId} failed: ${message}`);
    await finishJob(jobId, 'failed', { error: message });
  }
}
