import crypto from 'node:crypto';
import { sql, j } from '../db/client.js';
import { fubClient } from '../connectors/fub.js';
import { env } from '../env.js';
import { log } from '../logger.js';
import {
  fubAdminIds,
  resolveFubRelationships,
  resolveFubStageMap,
  resolveFubPipelineSideMap,
  upsertAppointmentRecord,
  upsertContactRecord,
  upsertDealRecord,
  upsertNoteRecord,
  upsertTaskRecord,
  type Rec,
} from './fub.js';
import type { SyncResult } from './runner.js';

export interface FubWebhookPayload {
  eventId: string;
  eventCreated?: string;
  event: string;
  resourceIds?: Array<string | number>;
  uri?: string | null;
  data?: unknown;
}

const MAX_ATTEMPTS = 5;

/**
 * Verify the `FUB-Signature` header per Follow Up Boss's webhook guide:
 * base64-encode the exact raw request body, then HMAC-SHA256 it with the
 * system's X-System-Key; the hex digest must match the header. Must run on
 * the *raw* bytes as received — re-serializing the parsed JSON can produce a
 * byte-for-byte different string (key order, whitespace) and false-reject.
 */
export function verifyFubSignature(rawBody: string, signatureHeader: string | undefined): boolean {
  if (!env.FUB_SYSTEM_KEY) {
    log.warn('verifyFubSignature: FUB_SYSTEM_KEY not configured — rejecting webhook');
    return false;
  }
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac('sha256', env.FUB_SYSTEM_KEY)
    .update(Buffer.from(rawBody, 'utf8').toString('base64'))
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signatureHeader, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Record an inbound webhook event (idempotent on FUB's own eventId). Call
 * this from the route *before* acking, then trigger processing separately —
 * per FUB's guide, the table itself is the durable source of truth for what
 * has/hasn't been received, independent of whether processing later fails. */
export async function recordFubWebhookEvent(
  payload: FubWebhookPayload,
): Promise<{ id: number; duplicate: boolean }> {
  const inserted = await sql<{ id: number }[]>`
    insert into fub_webhook_events (event_id, event, resource_ids, uri, payload)
    values (
      ${payload.eventId}, ${payload.event},
      ${(payload.resourceIds ?? []).map(String)}, ${payload.uri ?? null}, ${j(payload)}
    )
    on conflict (event_id) do nothing
    returning id
  `;
  if (inserted.length) return { id: inserted[0]!.id, duplicate: false };
  const existing = await sql<{ id: number }[]>`
    select id from fub_webhook_events where event_id = ${payload.eventId}
  `;
  return { id: existing[0]?.id ?? -1, duplicate: true };
}

interface WebhookCtx {
  stageById: Map<string, string>;
  sideById: Map<string, 'buy' | 'sell' | 'rent'>;
  adminIds: Set<string>;
}

type UpsertFn = (rec: Rec, ctx: WebhookCtx) => Promise<void>;

const EVENT_HANDLERS: Record<string, { collectionKey: string; upsert: UpsertFn }> = {
  peopleCreated: { collectionKey: 'people', upsert: (rec) => upsertContactRecord(rec) },
  peopleUpdated: { collectionKey: 'people', upsert: (rec) => upsertContactRecord(rec) },
  dealsCreated: { collectionKey: 'deals', upsert: (rec, ctx) => upsertDealRecord(rec, ctx.stageById, ctx.sideById) },
  dealsUpdated: { collectionKey: 'deals', upsert: (rec, ctx) => upsertDealRecord(rec, ctx.stageById, ctx.sideById) },
  tasksCreated: { collectionKey: 'tasks', upsert: (rec, ctx) => upsertTaskRecord(rec, ctx.adminIds) },
  tasksUpdated: { collectionKey: 'tasks', upsert: (rec, ctx) => upsertTaskRecord(rec, ctx.adminIds) },
  notesCreated: { collectionKey: 'notes', upsert: (rec) => upsertNoteRecord(rec) },
  notesUpdated: { collectionKey: 'notes', upsert: (rec) => upsertNoteRecord(rec) },
  appointmentsCreated: { collectionKey: 'appointments', upsert: (rec) => upsertAppointmentRecord(rec) },
  appointmentsUpdated: { collectionKey: 'appointments', upsert: (rec) => upsertAppointmentRecord(rec) },
};

// Delete events carry no `uri` (nothing left to fetch) and today we don't
// auto-delete mirrored rows — a bad/duplicate delete would be destructive and
// FUB's people-delete cascades notes/calls/texts too, which we'd rather review
// than silently mirror. We still ack + log them so FUB stops retrying.
const DELETE_EVENTS = new Set([
  'peopleDeleted',
  'dealsDeleted',
  'tasksDeleted',
  'notesDeleted',
  'appointmentsDeleted',
]);

interface WebhookRow {
  id: number;
  event: string;
  uri: string | null;
  resource_ids: string[];
  attempts: number;
}

async function handleOneEvent(
  row: WebhookRow,
  ctx: WebhookCtx & { fub: NonNullable<ReturnType<typeof fubClient>> },
): Promise<void> {
  if (DELETE_EVENTS.has(row.event)) {
    log.info(`fub webhook: ${row.event} for id(s) [${row.resource_ids.join(',')}] — logged, not auto-deleted`);
    return;
  }
  const handler = EVENT_HANDLERS[row.event];
  if (!handler) {
    log.info(`fub webhook: no handler for event "${row.event}" — ignoring`);
    return;
  }
  if (!row.uri) {
    log.warn(`fub webhook: ${row.event} (row ${row.id}) had no uri to fetch — skipping`);
    return;
  }
  const data = await ctx.fub.get<Record<string, unknown>>(row.uri);
  const records = (data[handler.collectionKey] as Rec[]) ?? [];
  for (const rec of records) await handler.upsert(rec, ctx);
}

/**
 * Process pending rows in `fub_webhook_events`: fetch each event's changed
 * resource straight from FUB and upsert it, then re-derive relationships once
 * for the whole batch. Called (a) right after the webhook route acks a fresh
 * event, so changes land in seconds, and (b) on a cron safety net, so nothing
 * is lost if the process restarts mid-flight (the table row stays 'pending').
 */
export async function processPendingFubWebhookEvents(limit = 25): Promise<{ processed: number; errors: number }> {
  const fub = fubClient();
  if (!fub) return { processed: 0, errors: 0 };

  const rows = await sql<WebhookRow[]>`
    select id, event, uri, resource_ids, attempts from fub_webhook_events
    where status = 'pending' order by id asc limit ${limit}
  `;
  if (!rows.length) return { processed: 0, errors: 0 };

  const [stageById, sideById, adminIds] = [
    await resolveFubStageMap(fub),
    await resolveFubPipelineSideMap(fub),
    fubAdminIds(),
  ];
  let processed = 0;
  let errors = 0;
  for (const row of rows) {
    try {
      await handleOneEvent(row, { fub, stageById, sideById, adminIds });
      await sql`
        update fub_webhook_events set status = 'processed', processed_at = now(), error = null
        where id = ${row.id}
      `;
      processed++;
    } catch (err) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      const attempts = row.attempts + 1;
      log.warn(`fub webhook event ${row.id} (${row.event}) failed (attempt ${attempts})`, err);
      await sql`
        update fub_webhook_events set
          status = ${attempts >= MAX_ATTEMPTS ? 'error' : 'pending'},
          attempts = ${attempts}, error = ${message.slice(0, 500)}
        where id = ${row.id}
      `;
    }
  }
  if (processed > 0) {
    await resolveFubRelationships().catch((err) =>
      log.warn('processPendingFubWebhookEvents: resolveFubRelationships failed', err),
    );
  }
  return { processed, errors };
}

/** Wrapper matching the SyncResult shape so this can run through the same
 * sync_runs observability as every other source (see Orchestration Hub docs). */
export async function syncFubWebhooks(): Promise<SyncResult> {
  const { processed, errors } = await processPendingFubWebhookEvents();
  return { source: 'fub-webhooks', records: processed, meta: { errors } };
}
