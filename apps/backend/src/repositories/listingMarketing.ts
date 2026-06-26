import { createHash } from 'node:crypto';
import { sql, j } from '../db/client.js';
import { env } from '../env.js';
import { log } from '../logger.js';

/**
 * Listing marketing agent — job queue plumbing.
 *
 * A seller onboarding enqueues a best-effort job (see handleIntake). A worker
 * claims queued jobs and drafts an on-brand, Fair-Housing-compliant marketing
 * package for HUMAN review. Drafts only — nothing here ever auto-publishes.
 *
 * Idempotency: input_hash is derived from the questionnaire + the MLS facts the
 * agent would actually use. Re-submitting the form with unchanged answers hits
 * the unique (listing_id, input_hash) index and is a no-op, so a re-submit never
 * triggers a paid run. Changed answers → new hash → new job → a new version.
 */

export type JobStatus = 'queued' | 'claimed' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface MarketingJob {
  id: string;
  listing_id: string;
  status: JobStatus;
  input_hash: string;
  attempts: number;
  max_attempts: number;
}

/** The verified inputs the agent grounds on — also the idempotency surface. */
interface ListingInputs {
  address: string | null;
  neighborhood: string | null;
  listing_type: string | null;
  list_price: string | null;
  beds: string | null;
  baths: string | null;
  sq_ft: number | null;
  mls_property_type: string | null;
  mls_remarks: string | null;
  mls_city: string | null;
  mls_state: string | null;
  mls_zip: string | null;
  seller_questionnaire_content: string | null;
}

async function loadListingInputs(listingId: string): Promise<ListingInputs | null> {
  const [row] = await sql<ListingInputs[]>`
    select
      address, neighborhood, listing_type, list_price, beds, baths, sq_ft,
      mls_property_type, mls_remarks, mls_city, mls_state, mls_zip,
      seller_questionnaire_content
    from listings_enriched
    where id = ${listingId}::uuid
    limit 1
  `;
  return row ?? null;
}

/**
 * Stable SHA-256 over the questionnaire + relevant MLS facts. Key order is
 * fixed (ListingInputs literal) so the same inputs always hash the same.
 */
function computeInputHash(inputs: ListingInputs): string {
  const canonical = JSON.stringify({
    address: inputs.address ?? '',
    neighborhood: inputs.neighborhood ?? '',
    listing_type: inputs.listing_type ?? '',
    list_price: inputs.list_price ?? '',
    beds: inputs.beds ?? '',
    baths: inputs.baths ?? '',
    sq_ft: inputs.sq_ft ?? '',
    mls_property_type: inputs.mls_property_type ?? '',
    mls_remarks: inputs.mls_remarks ?? '',
    mls_city: inputs.mls_city ?? '',
    mls_state: inputs.mls_state ?? '',
    mls_zip: inputs.mls_zip ?? '',
    questionnaire: inputs.seller_questionnaire_content ?? '',
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Queue a marketing-draft job for a listing. Best-effort and idempotent:
 *   • no-op when the feature is disabled (LISTING_AGENT_ENABLED),
 *   • no-op when there's no questionnaire to ground on,
 *   • no-op when a job for this listing+input already exists.
 * Never runs the model — the worker does that out-of-band.
 */
export async function enqueueListingMarketing(listingId: string): Promise<{ jobId: string | null; skipped: boolean }> {
  if (!env.LISTING_AGENT_ENABLED) return { jobId: null, skipped: true };

  const inputs = await loadListingInputs(listingId);
  if (!inputs || !inputs.seller_questionnaire_content) {
    log.info(`listing ${listingId} marketing enqueue skipped (no questionnaire)`);
    return { jobId: null, skipped: true };
  }

  const inputHash = computeInputHash(inputs);
  const [row] = await sql<{ id: string }[]>`
    insert into listing_marketing_jobs (listing_id, input_hash, status)
    values (${listingId}::uuid, ${inputHash}, 'queued')
    on conflict (listing_id, input_hash) do nothing
    returning id
  `;
  if (!row) {
    log.info(`listing ${listingId} marketing job already queued for input ${inputHash.slice(0, 12)}`);
    return { jobId: null, skipped: true };
  }
  log.info(`listing ${listingId} marketing job ${row.id} queued`);
  return { jobId: row.id, skipped: false };
}

/**
 * Atomically claim the next runnable job. `for update skip locked` keeps a second
 * worker (or an overlapping cron tick) from double-spending on the same job.
 */
export async function claimNextJob(): Promise<MarketingJob | null> {
  const [job] = await sql<MarketingJob[]>`
    update listing_marketing_jobs
    set status = 'claimed', claimed_at = now(), attempts = attempts + 1, updated_at = now()
    where id = (
      select id from listing_marketing_jobs
      where status = 'queued' and run_after <= now() and attempts < max_attempts
      order by created_at
      for update skip locked
      limit 1
    )
    returning id, listing_id, status, input_hash, attempts, max_attempts
  `;
  return job ?? null;
}

/** Mark a claimed job as actively running (records started_at). */
export async function markJobRunning(jobId: string): Promise<void> {
  await sql`
    update listing_marketing_jobs
    set status = 'running', started_at = now(), updated_at = now()
    where id = ${jobId}::uuid
  `;
}

/** Record the model + token counts + estimated cost for a run on the job row. */
export async function recordJobUsage(
  jobId: string,
  usage: { model: string; inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number },
): Promise<void> {
  await sql`
    update listing_marketing_jobs
    set model = ${usage.model},
        input_tokens = ${usage.inputTokens},
        output_tokens = ${usage.outputTokens},
        total_tokens = ${usage.totalTokens},
        estimated_cost_usd = ${usage.estimatedCostUsd},
        updated_at = now()
    where id = ${jobId}::uuid
  `;
}

/** Move a job to a terminal state, recording an optional error + meta. */
export async function finishJob(
  jobId: string,
  status: Extract<JobStatus, 'succeeded' | 'failed' | 'skipped'>,
  opts: { error?: string; meta?: Record<string, unknown> } = {},
): Promise<void> {
  await sql`
    update listing_marketing_jobs
    set status = ${status}, finished_at = now(), updated_at = now(),
        error = ${opts.error ?? null},
        meta = ${j(opts.meta ?? {})}
    where id = ${jobId}::uuid
  `;
}

export interface DraftInput {
  listingId: string;
  jobId: string;
  mlsDescription: string;
  socialCaptions: string[];
  emailBlast: string;
  factSheet: Record<string, unknown>;
  contentPillar: string;
  assets?: Record<string, unknown>;
  compliance?: Record<string, unknown>;
  compliancePassed?: boolean;
}

/**
 * Write a new draft row, assigning the next per-listing version atomically.
 * status is always 'draft' — nothing here is published. compliance_passed
 * stays false until the M3 ComplianceAgent gate marks it ready.
 */
export async function writeDraft(input: DraftInput): Promise<{ id: string; version: number }> {
  const [row] = await sql<{ id: string; version: number }[]>`
    insert into listing_marketing_drafts (
      listing_id, job_id, version, status, content_pillar, mls_description,
      social_captions, email_blast, fact_sheet, assets, compliance, compliance_passed
    )
    select
      ${input.listingId}::uuid, ${input.jobId}::uuid,
      coalesce(max(version), 0) + 1, 'draft', ${input.contentPillar},
      ${input.mlsDescription}, ${j(input.socialCaptions)}, ${input.emailBlast},
      ${j(input.factSheet)}, ${j(input.assets ?? {})}, ${j(input.compliance ?? {})},
      ${input.compliancePassed ?? false}
    from listing_marketing_drafts
    where listing_id = ${input.listingId}::uuid
    returning id, version
  `;
  return { id: row!.id, version: row!.version };
}
