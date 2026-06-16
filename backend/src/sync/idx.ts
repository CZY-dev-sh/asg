import { sql, j } from '../db/client.js';
import { idxClient, type NormalizedIdxListing } from '../connectors/idx.js';
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

  // Auto-link ASG listings to their IDX match by normalized address.
  await sql`
    update listings l
    set idx_listing_id = x.idx_listing_id, updated_at = now()
    from idx_listings x
    where l.idx_listing_id is null
      and l.address_normalized is not null
      and l.address_normalized = x.address_normalized
  `;

  return { source: 'idx', records: listings.length, meta: { feeds: 3 } };
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
