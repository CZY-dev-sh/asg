import { sql, j } from '../db/client.js';
import { env, have } from '../env.js';
import {
  drive,
  extractDriveId,
  listImages,
  listRecentSubfolders,
  downloadFile,
} from '../connectors/drive.js';
import { uploadObject } from '../storage.js';
import { httpFetch } from '../util/http.js';
import { log } from '../logger.js';
import type { SyncResult } from './runner.js';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

interface ListingRow {
  id: string;
  address: string;
  photos_folder_url: string | null;
}

/**
 * Photo mirror: for every ASG listing with a Drive photo folder, enumerate the
 * folder, download each image, upload it into Supabase Storage (public CDN), and
 * upsert a listing_photos row with the mirrored public URL. This is what makes
 * photos live in Supabase rather than behind Google auth.
 */
export async function syncPhotos(opts: { mirrorIdx?: boolean } = {}): Promise<SyncResult> {
  if (!have.drive()) throw new Error('Google Drive not configured');
  if (!have.supabaseStorage()) throw new Error('Supabase Storage not configured');

  const listings = await sql<ListingRow[]>`
    select id, address, photos_folder_url
    from listings
    where photos_folder_url is not null and photos_folder_url <> ''
  `;

  let uploaded = 0;
  for (const listing of listings) {
    const folderId = extractDriveId(listing.photos_folder_url);
    if (!folderId) continue;
    try {
      uploaded += await mirrorFolder(listing.id, folderId);
    } catch (err) {
      log.warn(`photo mirror failed for ${listing.address}: ${String(err)}`);
    }
  }

  if (opts.mirrorIdx) uploaded += await mirrorIdxPhotos();

  return { source: 'photos', records: uploaded, meta: { listings: listings.length } };
}

async function mirrorFolder(listingId: string, folderId: string): Promise<number> {
  const files = await listImages(folderId);
  let count = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    // Skip if we already mirrored this exact Drive file.
    const [existing] = await sql<{ id: string; mirrored: boolean }[]>`
      select id, mirrored from listing_photos
      where listing_id = ${listingId} and drive_file_id = ${f.id}
      limit 1
    `;
    if (existing?.mirrored) {
      await sql`update listing_photos set position = ${i} where id = ${existing.id}`;
      continue;
    }
    const bytes = await downloadFile(f.id);
    const ext = EXT[f.mimeType] ?? 'jpg';
    const path = `listings/${listingId}/${f.id}.${ext}`;
    const up = await uploadObject(env.STORAGE_BUCKET_LISTINGS, path, bytes, f.mimeType);
    await sql`
      insert into listing_photos (
        listing_id, source, position, caption, original_url, drive_file_id,
        storage_path, public_url, thumb_url, content_type, bytes, mirrored
      ) values (
        ${listingId}, 'drive', ${i}, ${f.name || null},
        ${f.webViewLink ?? null}, ${f.id}, ${up.path}, ${up.publicUrl}, ${up.publicUrl},
        ${up.contentType}, ${up.bytes}, true
      )
      on conflict (listing_id, drive_file_id) do update set
        position = excluded.position, storage_path = excluded.storage_path,
        public_url = excluded.public_url, thumb_url = excluded.thumb_url,
        content_type = excluded.content_type, bytes = excluded.bytes,
        mirrored = true, updated_at = now()
    `;
    count++;
  }
  // Promote the first mirrored photo to the listing cover if none set.
  await sql`
    update listings l set cover_image_url = p.public_url, updated_at = now()
    from (
      select public_url from listing_photos
      where listing_id = ${listingId} and source = 'drive'
      order by position asc limit 1
    ) p
    where l.id = ${listingId} and (l.cover_image_url is null or l.cover_image_url = '')
  `;
  return count;
}

/** Optionally copy IDX CDN photos into Supabase Storage for resilience. */
async function mirrorIdxPhotos(): Promise<number> {
  const photos = await sql<{ id: string; idx_listing_id: string; position: number; original_url: string }[]>`
    select id, idx_listing_id, position, original_url
    from listing_photos
    where source = 'idx' and mirrored = false and original_url is not null
    limit 2000
  `;
  let count = 0;
  for (const p of photos) {
    try {
      const res = await httpFetch(p.original_url, { retries: 2 });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') ?? 'image/jpeg';
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = EXT[ct] ?? 'jpg';
      const path = `idx/${p.idx_listing_id}/${p.position}.${ext}`;
      const up = await uploadObject(env.STORAGE_BUCKET_LISTINGS, path, buf, ct);
      await sql`
        update listing_photos
        set storage_path = ${up.path}, public_url = ${up.publicUrl}, thumb_url = ${up.publicUrl},
            content_type = ${up.contentType}, bytes = ${up.bytes}, mirrored = true, updated_at = now()
        where id = ${p.id}
      `;
      count++;
    } catch {
      // best-effort
    }
  }
  return count;
}

/** Sync the most-recently-modified Drive subfolders for the Recent Folders API. */
export async function syncDriveFolders(): Promise<SyncResult> {
  if (!have.drive()) throw new Error('Google Drive not configured');
  drive(); // validate auth early
  const roots: Array<{ id: string; kind: 'listing' | 'agent' | 'brand' }> = [];
  if (env.DRIVE_LISTING_PHOTOS_ROOT) roots.push({ id: env.DRIVE_LISTING_PHOTOS_ROOT, kind: 'listing' });
  if (env.DRIVE_AGENT_FOLDERS_ROOT) roots.push({ id: env.DRIVE_AGENT_FOLDERS_ROOT, kind: 'agent' });

  let count = 0;
  for (const root of roots) {
    const folders = await listRecentSubfolders(root.id, 12);
    for (const f of folders) {
      await sql`
        insert into drive_folders (id, name, parent_id, kind, modified_at, web_url, raw, synced_at)
        values (${f.id}, ${f.name}, ${root.id}, ${root.kind}::drive_folder_kind,
                ${f.modifiedTime ?? null}, ${f.webViewLink ?? null}, ${j(f)}, now())
        on conflict (id) do update set
          name = excluded.name, modified_at = excluded.modified_at,
          web_url = excluded.web_url, raw = excluded.raw, synced_at = now()
      `;
      count++;
    }
  }
  return { source: 'drive-folders', records: count };
}
