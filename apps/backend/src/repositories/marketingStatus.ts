import { sql, j } from '../db/client.js';
import { have } from '../env.js';
import { setTaskCompleted } from '../connectors/asana.js';
import { log } from '../logger.js';

type Row = Record<string, unknown>;

/**
 * Listing asset columns a request kind flips when its work is delivered.
 * Single source of truth shared by the marketing sync (Asana → hub) and the
 * hub-driven status toggle, so both stay in lockstep.
 */
export const REQUEST_DELIVERED_COL: Record<string, { status?: string; deliveredAt?: string }> = {
  open_house_materials: { status: 'open_house_materials_status', deliveredAt: 'open_house_materials_delivered_at' },
  fact_sheet: { status: 'fact_sheet_status', deliveredAt: 'fact_sheet_delivered_at' },
  photos: { status: 'photos_status', deliveredAt: 'photos_delivered_at' },
  matterport: { status: 'matterport_status', deliveredAt: 'matterport_delivered_at' },
  floor_plan: { status: 'floor_plan_status', deliveredAt: 'floor_plan_delivered_at' },
  video: { status: 'video_status', deliveredAt: 'video_delivered_at' },
  other: {},
};

/** Flip the listing's per-asset status to Delivered (or clear it) for a kind. */
export async function applyListingDelivery(listingId: string, kind: string, delivered: boolean): Promise<void> {
  const col = REQUEST_DELIVERED_COL[kind] ?? {};
  if (col.status)
    await sql`update listings set ${sql(col.status)} = ${delivered ? 'Delivered' : 'In Progress'} where id = ${listingId}::uuid`;
  if (col.deliveredAt)
    await sql`update listings set ${sql(col.deliveredAt)} = ${delivered ? sql`now()` : null} where id = ${listingId}::uuid`;
}

/** Roll the listing's marketing_status up from its open requests. */
async function rollUpMarketingStatus(listingId: string): Promise<void> {
  const [open] = await sql<Row[]>`
    select count(*)::int as n from listing_requests
    where listing_id = ${listingId}::uuid and status <> 'delivered'`;
  await sql`update listings set marketing_status = ${Number(open?.n ?? 0) > 0 ? 'In Progress' : 'Done'}
            where id = ${listingId}::uuid`;
}

/**
 * Hub-driven status change for a listing request. Mirrors what syncMarketing does
 * when a task completes in Asana, but originated from the hub: updates the request,
 * flips the listing asset status, rolls up marketing_status, logs the timeline, and
 * best-effort pushes completion back to Asana. Returns false if the request is gone.
 */
export async function setListingRequestStatus(
  requestId: string,
  status: 'requested' | 'in_progress' | 'done' | 'cancelled',
  actor: string | null = null,
): Promise<boolean> {
  const norm = status === 'done' ? 'delivered' : status;
  const [req] = await sql<Row[]>`
    select id, listing_id, kind, asana_task_gid from listing_requests where id = ${requestId}::uuid`;
  if (!req) return false;
  const listingId = String(req.listing_id);
  const kind = String(req.kind);

  if (norm === 'delivered') {
    await sql`update listing_requests set status = 'delivered', delivered_at = now() where id = ${requestId}::uuid`;
    await applyListingDelivery(listingId, kind, true);
    await sql`
      insert into listing_activity (listing_id, type, label, actor, meta, client_visible)
      values (${listingId}::uuid, 'materials_delivered', ${'Delivered: ' + kind}, ${actor ?? 'Hub'}, ${j({ requestId })}, true)`;
  } else {
    await sql`update listing_requests set status = ${norm}, delivered_at = null where id = ${requestId}::uuid`;
    if (REQUEST_DELIVERED_COL[kind]?.status) await applyListingDelivery(listingId, kind, false);
  }
  await rollUpMarketingStatus(listingId);

  if (have.asana() && req.asana_task_gid) {
    try {
      await setTaskCompleted(String(req.asana_task_gid), norm === 'delivered');
    } catch (err) {
      log.warn(`asana complete mirror failed (request ${requestId}): ${String(err)}`);
    }
  }
  return true;
}
