import { env } from '../env.js';
import { sql } from '../db/client.js';
import { log } from '../logger.js';

type HubRow = {
  address?: string;
  mlsNumber?: string;
  idxListingId?: string;
  neighborhood?: string;
};

const FALLBACK_AGENT = 'Alex Stoykov';

/**
 * Overlay per-listing neighborhood from the "Listing Hub" sheet (Apps Script
 * JSON) — the IDX bulk feed rarely provides it. Rows match by MLS number
 * first, then by standardized address.
 *
 * Agent assignment is deliberately NOT sourced from the sheet: its co-list
 * column mixes MLS data with hand-entered and guessed values. Assignment is
 * manual — admins set the listing agent in the console, and the seller wizard
 * assigns the agent the seller picked. This overlay never overwrites those;
 * it only defaults still-unassigned open listings to Alex Stoykov.
 */
export async function overlayListingHub(): Promise<{ rows: number; matched: number }> {
  if (!env.LISTING_HUB_API) return { rows: 0, matched: 0 };
  let rows: HubRow[];
  try {
    const res = await fetch(`${env.LISTING_HUB_API}?view=active`);
    const data = (await res.json()) as { success?: boolean; listings?: HubRow[] };
    if (!data?.success || !Array.isArray(data.listings)) throw new Error('bad listing hub payload');
    rows = data.listings;
  } catch (err) {
    log.warn(`listing hub overlay skipped: ${String(err)}`);
    return { rows: 0, matched: 0 };
  }

  let matched = 0;
  for (const r of rows) {
    const address = (r.address ?? '').trim();
    const mls = (r.mlsNumber ?? r.idxListingId ?? '').trim();
    const hood = (r.neighborhood ?? '').trim();
    if (!hood || (!address && !mls)) continue;
    const result = await sql`
      update listings l
      set neighborhood = ${hood}, updated_at = now()
      where l.neighborhood is null
        and ((${mls} <> '' and l.idx_listing_id = ${mls})
          or (l.address_std is not null and l.address_std = address_std(${address})))
    `;
    matched += (result as unknown as { count?: number }).count ?? 0;
  }

  // Open listings nobody has assigned yet default to Alex Stoykov.
  await sql`
    update listings
    set agent_name = ${FALLBACK_AGENT},
        agent_id = (select id from agents where name = ${FALLBACK_AGENT} limit 1),
        updated_at = now()
    where agent_name is null
      and archived = false
      and coalesce(status, '') not ilike 'closed%'
  `;

  return { rows: rows.length, matched };
}
