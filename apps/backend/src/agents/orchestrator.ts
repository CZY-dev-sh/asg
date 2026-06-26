import { anthropicClient, RunBudget } from '../connectors/anthropic.js';
import { env } from '../env.js';
import { log } from '../logger.js';
import { loadBrandGuide } from './brand.js';
import { loadListingFactRow, runResearch } from './research.js';
import { runCopy } from './copy.js';
import type { OrchestratorResult } from './types.js';

/** Raised when a listing has nothing to ground on (no questionnaire/facts). */
export class NoGroundingError extends Error {
  constructor(listingId: string) {
    super(`listing ${listingId} has no questionnaire/facts to ground on`);
    this.name = 'NoGroundingError';
  }
}

/**
 * Run the marketing agent for a listing: ResearchAgent (verified facts) then
 * CopyAgent (on-brand package), sharing one token budget so the whole run is
 * capped by LISTING_AGENT_MAX_TOKENS_PER_RUN. Returns the package + usage/cost.
 *
 * Drafts only — the compliance gate that marks a draft "ready" arrives in M3,
 * so the caller writes the draft with compliance_passed = false for now.
 */
export async function runListingMarketingAgent(listingId: string): Promise<OrchestratorResult> {
  const client = anthropicClient();
  if (!client) throw new Error('anthropic not configured');

  const row = await loadListingFactRow(listingId);
  if (!row || !row.seller_questionnaire_content) throw new NoGroundingError(listingId);

  const budget = new RunBudget(env.LISTING_AGENT_MAX_TOKENS_PER_RUN);
  const brand = await loadBrandGuide();

  const research = await runResearch({ client, row, budget });
  log.info(`listing ${listingId} research done (${research.usage.totalTokens} tok, $${research.estimatedCostUsd.toFixed(4)})`);

  const copy = await runCopy({ client, brand, facts: research.facts, budget });
  log.info(`listing ${listingId} copy done (${copy.usage.totalTokens} tok, $${copy.estimatedCostUsd.toFixed(4)})`);

  const estimatedCostUsd = Math.round((research.estimatedCostUsd + copy.estimatedCostUsd) * 1_000_000) / 1_000_000;

  return {
    facts: research.facts,
    pkg: copy.pkg,
    models: { research: research.model, copy: copy.model },
    totalTokens: budget.totalTokens,
    estimatedCostUsd,
    usageByStep: [
      { step: 'research', model: research.model, usage: research.usage },
      { step: 'copy', model: copy.model, usage: copy.usage },
    ],
  };
}
