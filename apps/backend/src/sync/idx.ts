import { sql, j } from '../db/client.js';
import { idxClient, type NormalizedIdxListing } from '../connectors/idx.js';
import { overlayListingHub } from './listingHub.js';
import type { SyncResult } from './runner.js';

/**
 * Pull featured + soldpending + supplemental from IDX into idx_listings, refresh
 * IDX photo rows, then resolve listings.idx_listing_id by normalized address so
 * the listings_enriched view can merge MLS facts onto ASG workflow rows.
 */
export async function syncIdx(): Promise<SyncResult> {
  const client = idxClient();
  if (!client) throw new Error('IDX not configured (IDX_ACCESS_KEY)');

  const listings = await client.allListings();
  for (const L of listings) {
    await upsertIdxListing(L);
    await refreshIdxPhotos(L);
  }

  // 1) Exact normalized-address link (fast path).
  await sql`
    update listings l
    set idx_listing_id = x.idx_listing_id, updated_at = now()
    from idx_listings x
    where l.idx_listing_id is null
      and l.address_normalized is not null
      and l.address_normalized = x.address_normalized
  `;

  // 2) Standardized link: align the street core across the two address formats
  // ("Pl" vs "Place", "W" vs "West", "Unit 3" vs "#3", trailing city/state/zip)
  // via exact-or-prefix on address_std. We link only when a listing maps to
  // exactly ONE idx row, so a unit-less address never silently links to the
  // wrong unit in the same building.
  await sql`
    update listings l
    set idx_listing_id = c.idx_listing_id, updated_at = now()
    from (
      select l2.id as listing_id, min(x.idx_listing_id) as idx_listing_id
      from listings l2
      join idx_listings x
        on l2.address_std is not null and x.address_std is not null
       and (
         x.address_std = l2.address_std
         or x.address_std like l2.address_std || ' %'
         or l2.address_std like x.address_std || ' %'
       )
      where l2.idx_listing_id is null
      group by l2.id
      having count(*) = 1
    ) c
    where l.id = c.listing_id
      and l.idx_listing_id is null
      and not exists (select 1 from listings l3 where l3.idx_listing_id = c.idx_listing_id)
  `;

  // Promote Coming Soon → live MLS status. Admin-created and seller-wizard
  // listings sit in "Coming Soon" until the property shows up in the IDX feed
  // (linked above by address); then they adopt the MLS status ("Active", etc.)
  // and the flip is recorded on the listing timeline.
  const promoted = await sql<{ id: string; new_status: string }[]>`
    update listings l
    set status = x.status, updated_at = now()
    from idx_listings x
    where l.idx_listing_id = x.idx_listing_id
      and lower(coalesce(l.status, '')) in ('coming soon', 'pre listing', 'pre-listing')
      and coalesce(x.status, '') <> ''
    returning l.id, x.status as new_status
  `;
  for (const p of promoted) {
    await sql`
      insert into listing_activity (listing_id, type, label, actor, meta, client_visible)
      values (${p.id}::uuid, 'status_changed', ${'Listed on MLS — status is now ' + p.new_status},
              'IDX sync', ${j({ from: 'Coming Soon', to: p.new_status })}, true)
    `;
  }

  // Co-listing agent groundwork: pull the co-list agent name from the IDX raw
  // payload (field name varies by feed), then resolve it to a roster agent so
  // listings can later route to each agent's personal hub by co_agent.
  await sql`
    update listings l
    set co_agent_name = coalesce(
          l.co_agent_name,
          x.raw->>'coListingAgentName', x.raw->>'coListAgentName',
          x.raw->>'coAgentName', x.raw->>'coListAgentFullName')
    from idx_listings x
    where l.idx_listing_id = x.idx_listing_id
      and coalesce(
          x.raw->>'coListingAgentName', x.raw->>'coListAgentName',
          x.raw->>'coAgentName', x.raw->>'coListAgentFullName', '') <> ''
  `;
  await sql`
    update listings l
    set co_agent_id = a.id
    from agents a
    where l.co_agent_id is null and l.co_agent_name is not null
      and lower(a.name) = lower(l.co_agent_name)
  `;

  // Materialize an editable ASG listing row for every MLS listing that doesn't
  // already have one (matched above by address/idx id). This makes the IDX feed
  // the source of truth for the inventory while letting admins layer marketing
  // assets on top. Pre-listings created at onboarding already linked above, so
  // they are skipped here. MLS facts are NOT copied onto listings — the
  // listings_enriched view coalesces them live from idx_listings.
  const materialized = await sql`
    insert into listings (address, idx_listing_id, source, status)
    select x.address, x.idx_listing_id, 'idx', x.status
    from idx_listings x
    where x.address is not null
      and x.address_normalized is not null
      and not exists (select 1 from listings l where l.idx_listing_id = x.idx_listing_id)
      and not exists (select 1 from listings l where l.address_normalized = x.address_normalized)
      and not exists (
        select 1 from listings l
        where l.address_std is not null and (
          l.address_std = x.address_std
          or x.address_std like l.address_std || ' %'
          or l.address_std like x.address_std || ' %'
        )
      )
    on conflict (address_normalized) do nothing
  `;
  const created = (materialized as unknown as { count?: number }).count ?? 0;

  // Assign agents + neighborhoods from the Listing Hub sheet (co-list agent
  // from the MLS, maintained there). Runs last so freshly materialized rows
  // are covered too.
  const overlay = await overlayListingHub();

  return {
    source: 'idx',
    records: listings.length,
    meta: { feeds: 3, listingsCreated: created, hubRows: overlay.rows, hubMatched: overlay.matched },
  };
}

async function upsertIdxListing(L: NormalizedIdxListing): Promise<void> {
  await sql`
    insert into idx_listings (
      idx_listing_id, feed, mls_number, address, city, state, zip, area_major, neighborhood,
      status, property_type, list_price, beds, baths, sq_ft, year_built, latitude, longitude,
      remarks, cover_image_url, photo_count, details_url, full_details_url, raw, synced_at
    ) values (
      ${L.idxListingId}, ${L.feed}, ${L.mlsNumber}, ${L.address}, ${L.city}, ${L.state}, ${L.zip},
      ${L.areaMajor}, ${L.neighborhood}, ${L.status}, ${L.propertyType}, ${L.listPrice},
      ${L.beds}, ${L.baths}, ${L.sqFt}, ${L.yearBuilt}, ${L.latitude}, ${L.longitude},
      ${L.remarks}, ${L.coverImageUrl}, ${L.photoCount}, ${L.detailsUrl}, ${L.fullDetailsUrl},
      ${j(L.raw)}, now()
    )
    on conflict (idx_listing_id) do update set
      feed = excluded.feed, mls_number = excluded.mls_number, address = excluded.address,
      city = excluded.city, state = excluded.state, zip = excluded.zip,
      area_major = excluded.area_major, neighborhood = excluded.neighborhood,
      status = excluded.status, property_type = excluded.property_type,
      list_price = excluded.list_price, beds = excluded.beds, baths = excluded.baths,
      sq_ft = excluded.sq_ft, year_built = excluded.year_built, latitude = excluded.latitude,
      longitude = excluded.longitude, remarks = excluded.remarks,
      cover_image_url = excluded.cover_image_url, photo_count = excluded.photo_count,
      details_url = excluded.details_url, full_details_url = excluded.full_details_url,
      raw = excluded.raw, synced_at = now(), updated_at = now()
  `;
}

async function refreshIdxPhotos(L: NormalizedIdxListing): Promise<void> {
  await sql`delete from listing_photos where idx_listing_id = ${L.idxListingId} and source = 'idx'`;
  if (L.photos.length === 0) return;
  // IDX photos live on a public MLS CDN; we reference them directly (publicUrl =
  // original). The photo mirror job can copy them into Supabase Storage later.
  const rows = L.photos.map((p) => ({
    idx_listing_id: L.idxListingId,
    source: 'idx' as const,
    position: p.order,
    caption: p.caption || null,
    original_url: p.url,
    public_url: p.url,
    thumb_url: p.url,
    mirrored: false,
  }));
  await sql`
    insert into listing_photos ${sql(rows, 'idx_listing_id', 'source', 'position', 'caption', 'original_url', 'public_url', 'thumb_url', 'mirrored')}
  `;
}
