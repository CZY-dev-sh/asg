import { env } from '../env.js';
import { sql } from '../db/client.js';
import { log } from '../logger.js';

type HubRow = {
  address?: string;
  mlsNumber?: string;
  idxListingId?: string;
  coListAgentName?: string;
  neighborhood?: string;
};

const FALLBACK_AGENT = 'Alex Stoykov';

/**
 * Overlay per-listing assignment from the "Listing Hub" sheet (Apps Script
 * JSON). The sheet carries the MLS co-list agent pulled from the MRED feed;
 * that person is the ASG agent who owns the listing, so we assign them as the
 * listing agent (falling back to Alex Stoykov when the sheet has no one).
 * Neighborhood is copied over too — the IDX feed rarely provides it.
 * Rows match by MLS number first, then by standardized address.
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
    const co = (r.coListAgentName ?? '').trim();
    const hood = (r.neighborhood ?? '').trim();
    const agentName = co || FALLBACK_AGENT;
    if (!address && !mls) continue;
    const result = await sql`
      update listings l
      set agent_name = ${agentName},
          agent_id = (select id from agents where lower(name) = lower(${agentName}) limit 1),
          co_agent_name = ${co || null},
          co_agent_id = (select id from agents where ${co} <> '' and lower(name) = lower(${co}) limit 1),
          neighborhood = coalesce(nullif(${hood}, ''), l.neighborhood),
          updated_at = now()
      where (${mls} <> '' and l.idx_listing_id = ${mls})
         or (l.address_std is not null and l.address_std = address_std(${address}))
    `;
    matched += (result as unknown as { count?: number }).count ?? 0;
  }

  // Open listings the sheet doesn't know about default to Alex Stoykov.
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
