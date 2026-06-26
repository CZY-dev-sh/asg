import { sql, j } from '../db/client.js';
import { uploadObject, supabase, createSignedUpload, publicUrlFor } from '../storage.js';
import { slugify, parseNumber, parseBool, parseDate, parseDateTime } from '../util/text.js';
import { env, have } from '../env.js';
import { createTaskInProject } from '../connectors/asana.js';
import { asanaAssigneeForName, ensureListingAsanaProject, listingMarketingRequestLabel } from './asanaListings.js';
import { log } from '../logger.js';

type Row = Record<string, unknown>;

/**
 * Per-column coercion so the UI can send loose values ("$1.25M", "yes",
 * "3/4/2026") and they land correctly in numeric / date / boolean columns.
 * Applied automatically inside pick().
 */
const COERCE: Record<string, (v: unknown) => unknown> = {
  list_price: parseNumber,
  beds: parseNumber,
  baths: parseNumber,
  sq_ft: parseNumber,
  seniority_rank: parseNumber,
  list_date: parseDate,
  listing_agreement_date: parseDate,
  next_birthday: parseDate,
  photos_datetime: parseDateTime,
  photos_delivered_at: parseDateTime,
  fact_sheet_requested_at: parseDateTime,
  fact_sheet_delivered_at: parseDateTime,
  open_house_materials_requested_at: parseDateTime,
  open_house_materials_delivered_at: parseDateTime,
  matterport_delivered_at: parseDateTime,
  floor_plan_delivered_at: parseDateTime,
  video_delivered_at: parseDateTime,
  shared_with_agent_at: parseDateTime,
  seller_questionnaire_sent_at: parseDateTime,
  starts_at: parseDateTime,
  ends_at: parseDateTime,
  published_at: parseDateTime,
  archived: parseBool,
  email_sent: parseBool,
  marketing_ready: parseBool,
  seller_questionnaire_sent: parseBool,
  active: parseBool,
  all_day: parseBool,
  pinned: parseBool,
  match_me: parseBool,
};

/** Thrown by write helpers; routes translate `.status` into an HTTP code. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ── generic helpers ───────────────────────────────────────────────────────

/** Pick allow-listed keys from `body`, mapping camelCase → snake_case column. */
function pick(body: Row, mapping: Record<string, string>): Row {
  const out: Row = {};
  for (const [key, col] of Object.entries(mapping)) {
    if (body[key] !== undefined) {
      const coerce = COERCE[col];
      out[col] = coerce ? coerce(body[key]) : body[key];
    }
  }
  return out;
}

/**
 * Apply a partial update to a uuid-keyed table. Scalar columns go in one
 * statement; uuid and jsonb columns are written separately so they get the
 * right cast (text→uuid) or JSONB encoding. `updated_at` is maintained by the
 * table's trigger. Returns the number of column groups written.
 */
async function applyUpdate(
  table: string,
  id: string,
  groups: { scalar?: Row; uuid?: Record<string, unknown>; json?: Record<string, unknown> },
  db: typeof sql = sql,
): Promise<number> {
  let writes = 0;
  const scalar = groups.scalar ?? {};
  if (Object.keys(scalar).length) {
    await db`update ${db(table)} set ${db(scalar)} where id = ${id}::uuid`;
    writes += Object.keys(scalar).length;
  }
  for (const [col, val] of Object.entries(groups.uuid ?? {})) {
    await db`update ${db(table)} set ${db(col)} = ${val == null ? null : String(val)}::uuid where id = ${id}::uuid`;
    writes++;
  }
  for (const [col, val] of Object.entries(groups.json ?? {})) {
    await db`update ${db(table)} set ${db(col)} = ${j(val)} where id = ${id}::uuid`;
    writes++;
  }
  return writes;
}

async function fetchOne(table: string, id: string): Promise<Row | null> {
  const [row] = await sql<Row[]>`select * from ${sql(table)} where id = ${id}::uuid limit 1`;
  return row ?? null;
}

// ════════════════════════════════════════════════════════════════════════
// Listings
// ════════════════════════════════════════════════════════════════════════

const LISTING_SCALARS: Record<string, string> = {
  address: 'address',
  slug: 'slug',
  neighborhood: 'neighborhood',
  agentName: 'agent_name',
  status: 'status',
  phaseKey: 'phase_key',
  listingType: 'listing_type',
  listPrice: 'list_price',
  listDate: 'list_date',
  listingAgreementDate: 'listing_agreement_date',
  smoCredit: 'smo_credit',
  mlsNumber: 'mls_number',
  beds: 'beds',
  baths: 'baths',
  sqFt: 'sq_ft',
  coverImageUrl: 'cover_image_url',
  photosFolderUrl: 'photos_folder_url',
  matterportUrl: 'matterport_url',
  floorPlanUrl: 'floor_plan_url',
  videoUrl: 'video_url',
  factSheetUrl: 'fact_sheet_url',
  bookletUrl: 'booklet_url',
  openHouseMaterialsUrl: 'open_house_materials_url',
  storyUrl: 'story_url',
  signUrl: 'sign_url',
  marketingStatus: 'marketing_status',
  photosStatus: 'photos_status',
  photosDatetime: 'photos_datetime',
  photosDeliveredAt: 'photos_delivered_at',
  photosBookingId: 'photos_booking_id',
  photosBookingUrl: 'photos_booking_url',
  matterportStatus: 'matterport_status',
  matterportDeliveredAt: 'matterport_delivered_at',
  floorPlanStatus: 'floor_plan_status',
  floorPlanDeliveredAt: 'floor_plan_delivered_at',
  videoStatus: 'video_status',
  videoDeliveredAt: 'video_delivered_at',
  factSheetStatus: 'fact_sheet_status',
  factSheetRequestedAt: 'fact_sheet_requested_at',
  factSheetDeliveredAt: 'fact_sheet_delivered_at',
  openHouseMaterialsStatus: 'open_house_materials_status',
  openHouseMaterialsRequestedAt: 'open_house_materials_requested_at',
  openHouseMaterialsDeliveredAt: 'open_house_materials_delivered_at',
  compassLink: 'compass_link',
  coAgentName: 'co_agent_name',
  asanaProjectGid: 'asana_project_gid',
  marketingReady: 'marketing_ready',
  sharedWithAgentAt: 'shared_with_agent_at',
  sharedBy: 'shared_by',
  sellerName: 'seller_name',
  sellerEmail: 'seller_email',
  sellerPhone: 'seller_phone',
  sellerQuestionnaireContent: 'seller_questionnaire_content',
  sellerQuestionnaireSent: 'seller_questionnaire_sent',
  sellerQuestionnaireSentAt: 'seller_questionnaire_sent_at',
  asanaTaskId: 'asana_task_id',
  fubDealId: 'fub_deal_id',
  fubStage: 'fub_stage',
  idxListingId: 'idx_listing_id',
  archived: 'archived',
  emailSent: 'email_sent',
};

/** Map listing body → column groups (shared by create/update). */
function listingFields(body: Row): {
  scalar: Row;
  uuid: Record<string, unknown>;
  json: Record<string, unknown>;
} {
  const scalar = pick(body, LISTING_SCALARS);
  const uuid: Record<string, unknown> = {};
  if (body.agentId !== undefined) uuid.agent_id = body.agentId;
  if (body.coAgentId !== undefined) uuid.co_agent_id = body.coAgentId;
  if (body.leadId !== undefined) uuid.lead_id = body.leadId;
  const json: Record<string, unknown> = {};
  if (body.servicesBooked !== undefined) json.services_booked = body.servicesBooked;
  return { scalar, uuid, json };
}

export async function updateListing(id: string, body: Row): Promise<Row> {
  const existing = await fetchOne('listings', id);
  if (!existing) throw new ApiError(404, 'listing not found');
  const { scalar, uuid, json } = listingFields(body);
  if (!Object.keys(scalar).length && !Object.keys(uuid).length && !Object.keys(json).length)
    throw new ApiError(400, 'no writable fields supplied');
  await applyUpdate('listings', id, { scalar, uuid, json });
  return (await fetchOne('listings', id))!;
}

export async function createListing(body: Row): Promise<Row> {
  const address = String(body.address ?? '').trim();
  if (!address) throw new ApiError(400, 'address required');
  const slug = body.slug ? slugify(String(body.slug)) : slugify(address) || null;
  const rest = { ...body };
  delete rest.slug;
  const { scalar, uuid, json } = listingFields(rest);
  let id: string;
  try {
    // One transaction: stub insert + field updates roll back together.
    id = await sql.begin(async (tx) => {
      const [row] = await tx<Row[]>`
        insert into listings (address, slug, source) values (${address}, ${slug}, 'manual')
        returning id`;
      const newId = String(row!.id);
      if (Object.keys(scalar).length || Object.keys(uuid).length || Object.keys(json).length)
        await applyUpdate('listings', newId, { scalar, uuid, json }, tx as unknown as typeof sql);
      return newId;
    });
  } catch (err) {
    if (String(err).match(/listings_address_norm_uidx|listings_slug_key|duplicate key/i))
      throw new ApiError(409, 'a listing with this address or slug already exists');
    throw err;
  }
  return (await fetchOne('listings', id))!;
}

export async function setListingArchived(id: string, archived: boolean): Promise<Row> {
  const existing = await fetchOne('listings', id);
  if (!existing) throw new ApiError(404, 'listing not found');
  await sql`update listings set archived = ${archived} where id = ${id}::uuid`;
  return (await fetchOne('listings', id))!;
}

export async function deleteListing(id: string): Promise<{ ok: true; deleted: string }> {
  const [row] = await sql<Row[]>`delete from listings where id = ${id}::uuid returning id`;
  if (!row) throw new ApiError(404, 'listing not found');
  return { ok: true, deleted: id };
}

// ── Listing photos ────────────────────────────────────────────────────────

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

function decodeBase64(input: string): { buffer: Buffer; contentType?: string } {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(input.trim());
  if (match) return { buffer: Buffer.from(match[2] ?? '', 'base64'), contentType: match[1] };
  return { buffer: Buffer.from(input, 'base64') };
}

async function nextPhotoPosition(listingId: string): Promise<number> {
  const [row] = await sql<Row[]>`
    select coalesce(max(position), -1) + 1 as next from listing_photos where listing_id = ${listingId}::uuid`;
  return Number(row?.next ?? 0);
}

export async function addListingPhoto(
  listingId: string,
  input: { base64?: string; url?: string; contentType?: string; filename?: string; caption?: string; position?: number },
): Promise<Row> {
  const listing = await fetchOne('listings', listingId);
  if (!listing) throw new ApiError(404, 'listing not found');
  const position = input.position ?? (await nextPhotoPosition(listingId));

  if (input.base64) {
    const decoded = decodeBase64(input.base64);
    const contentType = input.contentType ?? decoded.contentType ?? 'image/jpeg';
    if (decoded.buffer.byteLength === 0) throw new ApiError(400, 'empty image payload');
    const ext = EXT_BY_TYPE[contentType] ?? 'jpg';
    const base = slugify(input.filename?.replace(/\.[^.]+$/, '') ?? `photo-${position}`) || `photo-${position}`;
    const path = `manual/${listingId}/${Date.now()}-${base}.${ext}`;
    const up = await uploadObject('listing-photos', path, decoded.buffer, contentType);
    const [row] = await sql<Row[]>`
      insert into listing_photos
        (listing_id, source, position, caption, original_url, storage_path, public_url, content_type, bytes, mirrored)
      values (${listingId}::uuid, 'manual', ${position}, ${input.caption ?? null}, ${up.publicUrl},
              ${up.path}, ${up.publicUrl}, ${contentType}, ${up.bytes}, true)
      returning *`;
    return row!;
  }

  if (input.url) {
    const [row] = await sql<Row[]>`
      insert into listing_photos (listing_id, source, position, caption, original_url, public_url, mirrored)
      values (${listingId}::uuid, 'manual', ${position}, ${input.caption ?? null}, ${input.url}, ${input.url}, false)
      returning *`;
    return row!;
  }

  throw new ApiError(400, 'provide base64 (with optional contentType/filename) or url');
}

export async function deleteListingPhoto(photoId: string): Promise<{ ok: true; deleted: string }> {
  const [row] = await sql<Row[]>`
    delete from listing_photos where id = ${photoId}::uuid returning id, storage_path`;
  if (!row) throw new ApiError(404, 'photo not found');
  if (row.storage_path) {
    try {
      await supabase().storage.from('listing-photos').remove([String(row.storage_path)]);
    } catch {
      /* storage cleanup is best-effort */
    }
  }
  return { ok: true, deleted: photoId };
}

export async function setListingCover(listingId: string, coverImageUrl: string): Promise<Row> {
  const listing = await fetchOne('listings', listingId);
  if (!listing) throw new ApiError(404, 'listing not found');
  await sql`update listings set cover_image_url = ${coverImageUrl} where id = ${listingId}::uuid`;
  return (await fetchOne('listings', listingId))!;
}

// ════════════════════════════════════════════════════════════════════════
// Listing workshop: activity, direct uploads, requests, share
// ════════════════════════════════════════════════════════════════════════

const LISTING_BUCKET = env.STORAGE_BUCKET_LISTINGS;

/** Append a milestone to a listing's activity timeline. */
export async function logActivity(
  listingId: string,
  type: string,
  label: string,
  actor: string | null = null,
  meta: Record<string, unknown> = {},
  clientVisible = false,
): Promise<void> {
  await sql`
    insert into listing_activity (listing_id, type, label, actor, meta, client_visible)
    values (${listingId}::uuid, ${type}, ${label}, ${actor}, ${j(meta)}, ${clientVisible})
  `;
}

/**
 * Build signed upload targets so the browser PUTs photos straight to Supabase
 * Storage (no base64 through the API). Returns the storage path, the one-time
 * signed URL/token, and the eventual public CDN url for each file.
 */
export async function signListingUploads(
  listingId: string,
  files: Array<{ name?: string; contentType?: string }>,
): Promise<Array<{ path: string; signedUrl: string; token: string; publicUrl: string }>> {
  const listing = await fetchOne('listings', listingId);
  if (!listing) throw new ApiError(404, 'listing not found');
  if (!Array.isArray(files) || files.length === 0) throw new ApiError(400, 'files[] required');
  const out: Array<{ path: string; signedUrl: string; token: string; publicUrl: string }> = [];
  for (const [i, f] of files.entries()) {
    const ext =
      EXT_BY_TYPE[String(f.contentType ?? '')] ??
      (f.name?.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'jpg').toLowerCase();
    const base = slugify(f.name?.replace(/\.[^.]+$/, '') ?? `photo-${i}`) || `photo-${i}`;
    const path = `manual/${listingId}/${Date.now()}-${i}-${base}.${ext}`;
    const signed = await createSignedUpload(LISTING_BUCKET, path);
    out.push({ path, signedUrl: signed.signedUrl, token: signed.token, publicUrl: publicUrlFor(LISTING_BUCKET, path) });
  }
  return out;
}

/** Register photos that the browser uploaded via signed URLs. */
export async function registerListingPhotos(
  listingId: string,
  items: Array<{ path: string; caption?: string; position?: number; contentType?: string }>,
): Promise<Row[]> {
  const listing = await fetchOne('listings', listingId);
  if (!listing) throw new ApiError(404, 'listing not found');
  if (!Array.isArray(items) || items.length === 0) throw new ApiError(400, 'photos[] required');
  let pos = await nextPhotoPosition(listingId);
  const rows: Row[] = [];
  for (const item of items) {
    if (!item.path) continue;
    const publicUrl = publicUrlFor(LISTING_BUCKET, item.path);
    const position = item.position ?? pos++;
    const [row] = await sql<Row[]>`
      insert into listing_photos
        (listing_id, source, position, caption, original_url, storage_path, public_url, content_type, mirrored)
      values (${listingId}::uuid, 'manual', ${position}, ${item.caption ?? null}, ${publicUrl},
              ${item.path}, ${publicUrl}, ${item.contentType ?? null}, true)
      returning *`;
    rows.push(row!);
  }
  if (rows.length)
    await logActivity(listingId, 'asset_uploaded', `${rows.length} photo(s) uploaded`, null, {
      count: rows.length,
    });
  return rows;
}

/** Reorder a listing's manual gallery. `order` is photo ids in display order. */
export async function reorderListingPhotos(
  listingId: string,
  order: string[],
): Promise<{ ok: true; count: number }> {
  if (!Array.isArray(order) || order.length === 0) throw new ApiError(400, 'order[] required');
  await sql.begin(async (tx) => {
    for (const [i, photoId] of order.entries()) {
      await tx`
        update listing_photos set position = ${i}
        where id = ${photoId}::uuid and listing_id = ${listingId}::uuid`;
    }
  });
  return { ok: true, count: order.length };
}

// ── Marketing requests (drive Asana from our DB) ──────────────────────────

/** Status column + requested-at column a request kind drives on the listing. */
const REQUEST_STATUS_COL: Record<string, { status: string; requestedAt?: string }> = {
  open_house_materials: { status: 'open_house_materials_status', requestedAt: 'open_house_materials_requested_at' },
  fact_sheet: { status: 'fact_sheet_status', requestedAt: 'fact_sheet_requested_at' },
  photos: { status: 'photos_status' },
  matterport: { status: 'matterport_status' },
  floor_plan: { status: 'floor_plan_status' },
  video: { status: 'video_status' },
};

/**
 * Create a marketing request. The request row is our system of record; if Asana
 * is configured we also ensure the listing has a project and spawn a task, then
 * store the task link back on the request. Status flows back via syncMarketing.
 */
export async function createRequest(
  listingId: string,
  input: { kind?: string; notes?: string; materials?: unknown; requestedBy?: string; assignee?: string },
): Promise<Row> {
  const listing = await fetchOne('listings', listingId);
  if (!listing) throw new ApiError(404, 'listing not found');
  const kind = String(input.kind ?? 'other');
  const label = listingMarketingRequestLabel(kind);
  const address = String(listing.address ?? '');
  const materials = Array.isArray(input.materials) ? input.materials : input.materials ? [input.materials] : [];
  const assignee = input.assignee ? String(input.assignee) : null;

  const [req] = await sql<Row[]>`
    insert into listing_requests (listing_id, kind, status, materials, notes, requested_by, assignee)
    values (${listingId}::uuid, ${kind}, 'requested', ${j(materials)}, ${input.notes ?? null}, ${input.requestedBy ?? null}, ${assignee})
    returning *`;
  const requestId = String(req!.id);

  // Ensure an Asana project for the listing, then create a task for the request.
  if (have.asana()) {
    try {
      const project = await ensureListingAsanaProject(listingId, { seedTasks: false });
      const projectGid = project.projectGid;
      if (projectGid) {
        const task = await createTaskInProject({
          projectGid,
          name: `${label} — ${address}`,
          notes: [
            input.notes ?? '',
            input.requestedBy ? `Requested by: ${input.requestedBy}` : '',
            assignee ? `Requested assignee: ${assignee}` : '',
          ].filter(Boolean).join('\n\n'),
          assigneeGid: asanaAssigneeForName(assignee),
        });
        if (task?.gid) {
          await sql`
            update listing_requests
            set asana_task_gid = ${task.gid}, asana_task_url = ${task.permalink_url ?? null}, status = 'in_progress'
            where id = ${requestId}::uuid`;
          await sql`
            insert into asana_tasks (id, title, listing_id, request_id, status, completed, url, synced_at)
            values (${task.gid}, ${label + ' — ' + address}, ${listingId}::uuid, ${requestId}::uuid, 'Open', false, ${task.permalink_url ?? null}, now())
            on conflict (id) do update set listing_id = excluded.listing_id, request_id = excluded.request_id`;
        }
      }
    } catch (err) {
      log.warn(`asana request sync failed for listing ${listingId}: ${String(err)}`);
    }
  }

  // Reflect the request on the listing's per-asset status columns.
  const map = REQUEST_STATUS_COL[kind];
  if (map) {
    await sql`update listings set ${sql(map.status)} = 'Requested' where id = ${listingId}::uuid`;
    if (map.requestedAt)
      await sql`update listings set ${sql(map.requestedAt)} = now() where id = ${listingId}::uuid`;
  }
  await sql`update listings set marketing_status = 'In Progress' where id = ${listingId}::uuid and coalesce(marketing_status,'') not in ('In Progress','Done')`;

  await logActivity(listingId, 'materials_requested', `${label} requested`, input.requestedBy ?? null, { kind, requestId }, true);

  return (await sql<Row[]>`select * from listing_requests where id = ${requestId}::uuid`)[0]!;
}

export async function canAgentAccessListing(input: {
  listingId: string;
  agentId?: string | null;
  email?: string | null;
}): Promise<boolean> {
  if (!input.agentId && !input.email) return false;
  const [row] = await sql<Row[]>`
    select id
    from listings_enriched
    where id = ${input.listingId}::uuid
      and (
        (${input.agentId ?? null}::uuid is not null and (agent_id = ${input.agentId ?? null}::uuid or co_agent_id = ${input.agentId ?? null}::uuid))
        or (${input.email ?? null}::text is not null and (
          lower(coalesce(agent_email,'')) = lower(${input.email ?? null})
          or lower(coalesce(co_agent_email,'')) = lower(${input.email ?? null})
        ))
      )
    limit 1
  `;
  return Boolean(row);
}

// ── Share with agent (pre-filled compose) ─────────────────────────────────

const enc = (s: string) => encodeURIComponent(s);

/**
 * Build a pre-filled email to the listing's (co-)agent with all delivered
 * marketing assets. Marks the listing shared and logs the milestone. The UI
 * opens the returned gmailUrl so the user reviews before sending.
 */
export async function buildShareEmail(
  listingId: string,
  actor: string | null = null,
): Promise<{ to: string; subject: string; body: string; gmailUrl: string; mailto: string }> {
  const [row] = await sql<Row[]>`
    select address, agent_name, agent_email, co_agent_name, co_agent_email,
           matterport_url, video_url, floor_plan_url, fact_sheet_url,
           open_house_materials_url, booklet_url, compass_link, photos_folder_url
    from listings_enriched where id = ${listingId}::uuid limit 1`;
  if (!row) throw new ApiError(404, 'listing not found');
  const to = String(row.co_agent_email ?? row.agent_email ?? '').trim();
  if (!to) throw new ApiError(400, 'no agent email on this listing to share with');
  const agentName = String(row.co_agent_name ?? row.agent_name ?? '').trim();
  const address = String(row.address ?? '');

  const assets: Array<[string, unknown]> = [
    ['Photos', row.photos_folder_url],
    ['Matterport 3D Tour', row.matterport_url],
    ['Video', row.video_url],
    ['Floor Plan', row.floor_plan_url],
    ['Fact Sheet', row.fact_sheet_url],
    ['Open House Materials', row.open_house_materials_url],
    ['Booklet', row.booklet_url],
    ['Compass Listing', row.compass_link],
  ];
  const lines: string[] = [];
  lines.push(`Hi ${agentName || 'there'},`);
  lines.push('');
  lines.push(`The marketing assets for ${address} are ready:`);
  lines.push('');
  for (const [name, url] of assets) {
    if (url && String(url).trim()) lines.push(`• ${name}: ${String(url).trim()}`);
  }
  lines.push('');
  lines.push('Let us know if you need anything else.');
  lines.push('');
  lines.push('— Alex Stoykov Group Marketing');
  const body = lines.join('\n');
  const subject = `Marketing assets ready — ${address}`;

  await sql`
    update listings set shared_with_agent_at = now(), shared_by = ${actor}, email_sent = true
    where id = ${listingId}::uuid`;
  await logActivity(listingId, 'shared_with_agent', `Shared marketing package with ${agentName || to}`, actor, { to });

  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to)}&su=${enc(subject)}&body=${enc(body)}`;
  const mailto = `mailto:${enc(to)}?subject=${enc(subject)}&body=${enc(body)}`;
  return { to, subject, body, gmailUrl, mailto };
}

// ════════════════════════════════════════════════════════════════════════
// Agents / directory
// ════════════════════════════════════════════════════════════════════════

const AGENT_SCALARS: Record<string, string> = {
  name: 'name',
  email: 'email',
  phone: 'phone',
  fubPhone: 'fub_phone',
  fubUserId: 'fub_user_id',
  tier: 'tier',
  role: 'role',
  dept: 'dept',
  hours: 'hours',
  headshotUrl: 'headshot_url',
  headshotPath: 'headshot_path',
  bio: 'bio',
  active: 'active',
  seniorityRank: 'seniority_rank',
  computedTier: 'computed_tier',
  nextBirthday: 'next_birthday',
  driveFolderId: 'drive_folder_id',
};

export async function createAgent(body: Row): Promise<Row> {
  const name = String(body.name ?? '').trim();
  if (!name) throw new ApiError(400, 'name required');
  const slug = body.slug ? slugify(String(body.slug)) : slugify(name);
  if (!slug) throw new ApiError(400, 'could not derive slug');
  let id: string;
  try {
    const [row] = await sql<Row[]>`insert into agents (slug, name) values (${slug}, ${name}) returning id`;
    id = String(row!.id);
  } catch (err) {
    if (String(err).match(/agents_slug_key|duplicate key/i))
      throw new ApiError(409, 'an agent with this slug already exists');
    throw err;
  }
  await updateAgent(id, { ...body, name });
  return (await fetchOne('agents', id))!;
}

export async function updateAgent(id: string, body: Row): Promise<Row> {
  const existing = await fetchOne('agents', id);
  if (!existing) throw new ApiError(404, 'agent not found');
  const scalar = pick(body, AGENT_SCALARS);
  const json: Record<string, unknown> = {};
  if (body.quickLinks !== undefined) json.quick_links = body.quickLinks;
  if (!Object.keys(scalar).length && !Object.keys(json).length)
    throw new ApiError(400, 'no writable fields supplied');
  await applyUpdate('agents', id, { scalar, json });
  return (await fetchOne('agents', id))!;
}

export async function setAgentActive(id: string, active: boolean): Promise<Row> {
  const existing = await fetchOne('agents', id);
  if (!existing) throw new ApiError(404, 'agent not found');
  await sql`update agents set active = ${active} where id = ${id}::uuid`;
  return (await fetchOne('agents', id))!;
}

export async function uploadHeadshot(
  id: string,
  input: { base64: string; contentType?: string; filename?: string },
): Promise<Row> {
  const agent = await fetchOne('agents', id);
  if (!agent) throw new ApiError(404, 'agent not found');
  const decoded = decodeBase64(input.base64);
  if (decoded.buffer.byteLength === 0) throw new ApiError(400, 'empty image payload');
  const contentType = input.contentType ?? decoded.contentType ?? 'image/jpeg';
  const ext = EXT_BY_TYPE[contentType] ?? 'jpg';
  const path = `${String(agent.slug)}-${Date.now()}.${ext}`;
  const up = await uploadObject('headshots', path, decoded.buffer, contentType);
  await sql`update agents set headshot_url = ${up.publicUrl}, headshot_path = ${up.path} where id = ${id}::uuid`;
  return (await fetchOne('agents', id))!;
}

// ════════════════════════════════════════════════════════════════════════
// Team events
// ════════════════════════════════════════════════════════════════════════

const EVENT_SCALARS: Record<string, string> = {
  title: 'title',
  startsAt: 'starts_at',
  endsAt: 'ends_at',
  allDay: 'all_day',
  location: 'location',
  description: 'description',
  audience: 'audience',
  url: 'url',
};

export async function createEvent(body: Row): Promise<Row> {
  const title = String(body.title ?? '').trim();
  if (!title) throw new ApiError(400, 'title required');
  const [row] = await sql<Row[]>`insert into team_events (title) values (${title}) returning id`;
  const id = String(row!.id);
  const scalar = pick({ ...body, title }, EVENT_SCALARS);
  if (Object.keys(scalar).length) await applyUpdate('team_events', id, { scalar });
  return (await fetchOne('team_events', id))!;
}

export async function updateEvent(id: string, body: Row): Promise<Row> {
  const existing = await fetchOne('team_events', id);
  if (!existing) throw new ApiError(404, 'event not found');
  const scalar = pick(body, EVENT_SCALARS);
  if (!Object.keys(scalar).length) throw new ApiError(400, 'no writable fields supplied');
  await applyUpdate('team_events', id, { scalar });
  return (await fetchOne('team_events', id))!;
}

export async function deleteEvent(id: string): Promise<{ ok: true; deleted: string }> {
  const [row] = await sql<Row[]>`delete from team_events where id = ${id}::uuid returning id`;
  if (!row) throw new ApiError(404, 'event not found');
  return { ok: true, deleted: id };
}

// ════════════════════════════════════════════════════════════════════════
// Team updates (announcements)
// ════════════════════════════════════════════════════════════════════════

const UPDATE_SCALARS: Record<string, string> = {
  title: 'title',
  body: 'body',
  publishedAt: 'published_at',
  audience: 'audience',
  pinned: 'pinned',
  author: 'author',
};

export async function createUpdate(body: Row): Promise<Row> {
  const title = String(body.title ?? '').trim();
  if (!title) throw new ApiError(400, 'title required');
  const [row] = await sql<Row[]>`insert into team_updates (title) values (${title}) returning id`;
  const id = String(row!.id);
  const scalar = pick({ ...body, title }, UPDATE_SCALARS);
  if (Object.keys(scalar).length) await applyUpdate('team_updates', id, { scalar });
  return (await fetchOne('team_updates', id))!;
}

export async function updateUpdate(id: string, body: Row): Promise<Row> {
  const existing = await fetchOne('team_updates', id);
  if (!existing) throw new ApiError(404, 'update not found');
  const scalar = pick(body, UPDATE_SCALARS);
  if (!Object.keys(scalar).length) throw new ApiError(400, 'no writable fields supplied');
  await applyUpdate('team_updates', id, { scalar });
  return (await fetchOne('team_updates', id))!;
}

export async function deleteUpdate(id: string): Promise<{ ok: true; deleted: string }> {
  const [row] = await sql<Row[]>`delete from team_updates where id = ${id}::uuid returning id`;
  if (!row) throw new ApiError(404, 'update not found');
  return { ok: true, deleted: id };
}

// ════════════════════════════════════════════════════════════════════════
// Leads (admin triage)
// ════════════════════════════════════════════════════════════════════════

const LEAD_SCALARS: Record<string, string> = {
  status: 'status',
  agentName: 'agent_name',
  agentEmail: 'agent_email',
  matchMe: 'match_me',
};

export async function listLeads(opts: { formType?: string; status?: string; limit?: number }) {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const rows = await sql<Row[]>`
    select id, form_type, name, email, phone, agent_name, agent_email, status,
           fub_person_id, fub_synced, created_at
    from leads
    where (${opts.formType ?? null}::text is null or form_type = ${opts.formType ?? null})
      and (${opts.status ?? null}::text is null or status = ${opts.status ?? null})
    order by created_at desc
    limit ${limit}`;
  return { ok: true, count: rows.length, leads: rows };
}

export async function updateLead(id: string, body: Row): Promise<Row> {
  const existing = await fetchOne('leads', id);
  if (!existing) throw new ApiError(404, 'lead not found');
  const scalar = pick(body, LEAD_SCALARS);
  const uuid: Record<string, unknown> = {};
  if (body.agentId !== undefined) uuid.agent_id = body.agentId;
  if (!Object.keys(scalar).length && !Object.keys(uuid).length)
    throw new ApiError(400, 'no writable fields supplied');
  await applyUpdate('leads', id, { scalar, uuid });
  return (await fetchOne('leads', id))!;
}

// ════════════════════════════════════════════════════════════════════════
// Landing pages
// ════════════════════════════════════════════════════════════════════════

const LANDING_JSON = ['hero', 'sections', 'stats', 'reviews', 'idxConfig', 'curatedListings'] as const;
const LANDING_JSON_COL: Record<string, string> = {
  hero: 'hero',
  sections: 'sections',
  stats: 'stats',
  reviews: 'reviews',
  idxConfig: 'idx_config',
  curatedListings: 'curated_listings',
};

// ════════════════════════════════════════════════════════════════════════
// Admin accounts + activity
// ════════════════════════════════════════════════════════════════════════

/** Update the signed-in user's own profile (name / phone). Role is protected
 * by the guard_profile_update trigger — clients/agents cannot escalate. */
export async function updateOwnProfile(
  userId: string,
  body: { fullName?: unknown; phone?: unknown; clientType?: unknown; portalPreferences?: unknown },
): Promise<Row | null> {
  const fullName = body.fullName == null ? null : String(body.fullName);
  const phone = body.phone == null ? null : String(body.phone);
  const rawClientType = body.clientType == null ? null : String(body.clientType).trim().toLowerCase();
  const clientType =
    rawClientType && ['buyer', 'seller', 'renter', 'undecided'].includes(rawClientType) ? rawClientType : null;
  if (rawClientType && !clientType) throw new ApiError(400, 'invalid clientType');
  const portalPreferences =
    body.portalPreferences && typeof body.portalPreferences === 'object'
      ? (body.portalPreferences as Record<string, unknown>)
      : null;
  if (fullName == null && phone == null && clientType == null && portalPreferences == null)
    throw new ApiError(400, 'nothing to update');
  await sql`
    update profiles set
      full_name = coalesce(${fullName}, full_name),
      phone = coalesce(${phone}, phone),
      client_type = coalesce(${clientType}::client_type, client_type),
      portal_onboarding_completed = case
        when ${clientType}::text in ('buyer', 'seller', 'renter') then true
        else portal_onboarding_completed
      end,
      portal_preferences = case
        when ${portalPreferences ? true : false} then ${j(portalPreferences ?? {})}
        else portal_preferences
      end
    where id = ${userId}::uuid`;
  const [row] = await sql<Row[]>`
    select id, email, full_name, phone, role, client_type, portal_onboarding_completed,
           portal_preferences, agent_id, contact_id
    from profiles where id = ${userId}::uuid`;
  return row ?? null;
}

/** Recent dashboard activity. Optionally filter to one admin by email. */
export async function listActivity(opts: { email?: string; limit?: number } = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const rows = await sql<Row[]>`
    select ts, type, page, label, url, agent_email, agent_name, meta
    from usage_events
    where (${opts.email ?? null}::text is null or lower(agent_email) = lower(${opts.email ?? null}))
    order by ts desc
    limit ${limit}`;
  return { ok: true, count: rows.length, events: rows };
}

export async function upsertLanding(slug: string, pageType: string, body: Row): Promise<Row> {
  const cleanSlug = slugify(slug);
  if (!cleanSlug) throw new ApiError(400, 'slug required');
  const type = String(pageType || 'general');
  const agentName = body.agentName == null ? null : String(body.agentName);
  const [row] = await sql<Row[]>`
    insert into landing_pages (slug, page_type, agent_name)
    values (${cleanSlug}, ${type}, ${agentName})
    on conflict (slug, page_type) do update set agent_name = coalesce(${agentName}, landing_pages.agent_name)
    returning id`;
  const id = String(row!.id);
  if (body.agentId !== undefined)
    await sql`update landing_pages set agent_id = ${body.agentId == null ? null : String(body.agentId)}::uuid where id = ${id}::uuid`;
  for (const key of LANDING_JSON) {
    const col = LANDING_JSON_COL[key];
    if (col && body[key] !== undefined)
      await sql`update landing_pages set ${sql(col)} = ${j(body[key])} where id = ${id}::uuid`;
  }
  return (await fetchOne('landing_pages', id))!;
}

// ════════════════════════════════════════════════════════════════════════
// Directory (source of truth = the "ASG Directory" Google Sheet)
// ════════════════════════════════════════════════════════════════════════

/** First non-empty value among `keys` on a loose sheet row. */
function pickKey(row: Row, keys: string[]): unknown {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
}

const str = (v: unknown): string | null => {
  const s = v == null ? '' : String(v).trim();
  return s ? s : null;
};

/** Map a free-text tier ("Senior", "junior", "Admin") onto the agent_tier enum. */
function normTier(v: unknown): 'senior' | 'junior' | 'admin' {
  const s = String(v ?? '').trim().toLowerCase();
  if (s.includes('senior')) return 'senior';
  if (s.includes('admin')) return 'admin';
  return 'junior';
}

export interface DirectoryUpsertResult {
  ok: true;
  upserted: number;
  deactivated: number;
}

/**
 * Replace the directory with the rows pushed from the Google Sheet. Each row is
 * upserted by email (the stable key); rows without an email fall back to slug.
 * When `deactivateMissing` is true (default) any emailed agent NOT in the
 * payload is flipped inactive, so deleting a row in the sheet removes them from
 * every UI surface. The whole sheet row is preserved in `raw`.
 */
export async function upsertDirectory(
  rows: unknown,
  opts: { deactivateMissing?: boolean } = {},
): Promise<DirectoryUpsertResult> {
  if (!Array.isArray(rows)) throw new ApiError(400, 'directory must be an array of rows');
  const deactivateMissing = opts.deactivateMissing !== false;
  const seenEmails: string[] = [];
  let upserted = 0;
  let deactivated = 0;

  await sql.begin(async (tx) => {
    const db = tx as unknown as typeof sql;
    for (const raw of rows as Row[]) {
      if (!raw || typeof raw !== 'object') continue;
      const email = (str(pickKey(raw, ['email', 'agent_email'])) ?? '').toLowerCase() || null;
      const name = str(pickKey(raw, ['name', 'display_name', 'agent_name']));
      if (!email && !name) continue; // blank row

      const slugSrc =
        pickKey(raw, ['agent_slug', 'slug']) ?? (email ? email.split('@')[0] : name);
      const slug = slugify(String(slugSrc));
      const tier = normTier(pickKey(raw, ['tier', 'role_group']));
      const adminRole = str(pickKey(raw, ['admin_role', 'role']));
      const icon = str(pickKey(raw, ['icon_photo_url', 'image_url', 'photo', 'headshot_url']));
      const seniority = parseNumber(
        pickKey(raw, ['computed_seniority_rank_overall', 'seniority_rank']),
      );

      await db`
        insert into agents (
          slug, name, email, phone, fub_phone, tier, role, admin_role,
          icon_photo_url, headshot_url, start_date, birthday, seniority_rank, next_birthday,
          headshots_url, landing_page_url, marketing_drive_url, buyer_guide_url, seller_guide_url,
          listing_presentation_url, business_card_url,
          buyer_guide_updated_at, seller_guide_updated_at,
          listing_presentation_updated_at, business_card_updated_at,
          active, directory_synced_at, raw
        ) values (
          ${slug}, ${name ?? slug}, ${email},
          ${str(pickKey(raw, ['phone_number', 'phone', 'mobile', 'cell']))},
          ${str(pickKey(raw, ['fub_number', 'fub_phone']))},
          ${tier}::agent_tier, ${adminRole}, ${adminRole},
          ${icon}, ${icon},
          ${parseDate(pickKey(raw, ['start_date', 'startdate', 'start']))},
          ${str(pickKey(raw, ['birthday_display', 'birthday', 'birth_date']))},
          ${seniority},
          ${parseDate(pickKey(raw, ['computed_next_birthday_iso', 'next_birthday']))},
          ${str(pickKey(raw, ['headshots', 'headshots_link', 'headshots_url']))},
          ${str(pickKey(raw, ['landing_page_url', 'landing_page']))},
          ${str(pickKey(raw, ['marketing_drive_url', 'marketing_drive_link']))},
          ${str(pickKey(raw, ['buyer_guide_url', 'buyer_guide_link']))},
          ${str(pickKey(raw, ['seller_guide_url', 'seller_guide_link']))},
          ${str(pickKey(raw, ['listing_presentation_url', 'listing_presentation_link']))},
          ${str(pickKey(raw, ['business_card_url', 'business_card_link']))},
          ${str(pickKey(raw, ['buyer_guide_updated_at']))},
          ${str(pickKey(raw, ['seller_guide_updated_at']))},
          ${str(pickKey(raw, ['listing_presentation_updated_at']))},
          ${str(pickKey(raw, ['business_card_updated_at']))},
          true, now(), ${j(raw)}
        )
        on conflict (${email ? db`email` : db`slug`}) do update set
          slug = excluded.slug,
          name = excluded.name,
          email = coalesce(excluded.email, agents.email),
          phone = excluded.phone,
          fub_phone = excluded.fub_phone,
          tier = excluded.tier,
          role = excluded.role,
          admin_role = excluded.admin_role,
          icon_photo_url = excluded.icon_photo_url,
          headshot_url = coalesce(excluded.headshot_url, agents.headshot_url),
          start_date = excluded.start_date,
          birthday = excluded.birthday,
          seniority_rank = excluded.seniority_rank,
          next_birthday = excluded.next_birthday,
          headshots_url = excluded.headshots_url,
          landing_page_url = excluded.landing_page_url,
          marketing_drive_url = excluded.marketing_drive_url,
          buyer_guide_url = excluded.buyer_guide_url,
          seller_guide_url = excluded.seller_guide_url,
          listing_presentation_url = excluded.listing_presentation_url,
          business_card_url = excluded.business_card_url,
          buyer_guide_updated_at = excluded.buyer_guide_updated_at,
          seller_guide_updated_at = excluded.seller_guide_updated_at,
          listing_presentation_updated_at = excluded.listing_presentation_updated_at,
          business_card_updated_at = excluded.business_card_updated_at,
          active = true,
          directory_synced_at = excluded.directory_synced_at,
          raw = excluded.raw,
          updated_at = now()
      `;
      if (email) seenEmails.push(email);
      upserted++;
    }

    if (deactivateMissing && seenEmails.length) {
      const res = await db`
        update agents set active = false, updated_at = now()
        where active = true and email is not null and lower(email) <> all(${seenEmails})`;
      // postgres.js exposes the affected count on the result's `count`.
      deactivated = (res as unknown as { count?: number }).count ?? 0;
    }
  });

  return { ok: true, upserted, deactivated };
}

// ════════════════════════════════════════════════════════════════════════
// Hub content (Events + Updates) — source of truth = Hub Data Google Sheet
// ════════════════════════════════════════════════════════════════════════

export interface HubContentResult {
  ok: true;
  events: number;
  updates: number;
}

/**
 * Mirror the "Events" and "Updates" tabs into Supabase. Each row carries an
 * `external_key` (derived in Apps Script from title + date) so re-runs upsert in
 * place rather than duplicating. Rows the console creates directly keep a null
 * external_key and are never touched here. The whole sheet row is kept in `raw`.
 */
export async function upsertHubContent(input: {
  events?: unknown;
  updates?: unknown;
}): Promise<HubContentResult> {
  const eventRows = Array.isArray(input.events) ? (input.events as Row[]) : [];
  const updateRows = Array.isArray(input.updates) ? (input.updates as Row[]) : [];
  let events = 0;
  let updates = 0;

  await sql.begin(async (tx) => {
    const db = tx as unknown as typeof sql;

    for (const raw of eventRows) {
      if (!raw || typeof raw !== 'object') continue;
      const title = str(pickKey(raw, ['title', 'event', 'event_title', 'name']));
      if (!title) continue;
      const externalKey =
        str(pickKey(raw, ['external_key', 'key'])) ?? `evt:${slugify(title)}`;
      const startsAt = parseDateTime(
        pickKey(raw, [
          'starts_at', 'start', 'start_datetime', 'datetime',
          'computed_event_datetime_iso', 'start_date', 'date', 'event_date',
        ]),
      );
      const endsAt = parseDateTime(pickKey(raw, ['ends_at', 'end', 'end_datetime']));
      await db`
        insert into team_events (
          title, starts_at, ends_at, all_day, location, description, audience, url,
          source, external_key, raw
        ) values (
          ${title}, ${startsAt}, ${endsAt},
          ${parseBool(pickKey(raw, ['all_day', 'allday']))},
          ${str(pickKey(raw, ['location', 'venue', 'place', 'address']))},
          ${str(pickKey(raw, ['description', 'details', 'notes', 'body', 'summary']))},
          ${str(pickKey(raw, ['audience', 'tier', 'role_group', 'visibility']))},
          ${str(pickKey(raw, ['url', 'link', 'rsvp_url', 'event_url']))},
          'sheet', ${externalKey}, ${j(raw)}
        )
        on conflict (external_key) where external_key is not null do update set
          title = excluded.title,
          starts_at = excluded.starts_at,
          ends_at = excluded.ends_at,
          all_day = excluded.all_day,
          location = excluded.location,
          description = excluded.description,
          audience = excluded.audience,
          url = excluded.url,
          source = 'sheet',
          raw = excluded.raw,
          updated_at = now()
      `;
      events++;
    }

    for (const raw of updateRows) {
      if (!raw || typeof raw !== 'object') continue;
      const title = str(pickKey(raw, ['title', 'headline', 'subject', 'name']));
      if (!title) continue;
      const externalKey =
        str(pickKey(raw, ['external_key', 'key'])) ?? `upd:${slugify(title)}`;
      const publishedAt = parseDateTime(
        pickKey(raw, [
          'published_at', 'publish_date', 'posted_at', 'date',
          'effective_date', 'computed_update_sort_iso',
        ]),
      );
      await db`
        insert into team_updates (
          title, body, published_at, audience, pinned, author,
          source, external_key, raw
        ) values (
          ${title},
          ${str(pickKey(raw, ['body', 'message', 'content', 'details', 'description']))},
          coalesce(${publishedAt}::timestamptz, now()),
          ${str(pickKey(raw, ['audience', 'tier', 'role_group', 'visibility']))},
          ${parseBool(pickKey(raw, ['pinned', 'pin', 'featured']))},
          ${str(pickKey(raw, ['author', 'posted_by', 'created_by']))},
          'sheet', ${externalKey}, ${j(raw)}
        )
        on conflict (external_key) where external_key is not null do update set
          title = excluded.title,
          body = excluded.body,
          published_at = excluded.published_at,
          audience = excluded.audience,
          pinned = excluded.pinned,
          author = excluded.author,
          source = 'sheet',
          raw = excluded.raw,
          updated_at = now()
      `;
      updates++;
    }
  });

  return { ok: true, events, updates };
}

// ════════════════════════════════════════════════════════════════════════
// Listings workflow import — source of truth = Listing Hub "Listings"/"Marketing"
// ════════════════════════════════════════════════════════════════════════

export interface ListingsImportResult {
  ok: true;
  upserted: number;
  created: number;
  linkedAgents: number;
}

/** Drop keys whose value is null/undefined/blank so blanks never clobber data. */
function dropEmpty(body: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    out[k] = v;
  }
  return out;
}

/**
 * Upsert the workflow/marketing overlay rows (keyed by normalized address) onto
 * the listings table. A row with no matching listing is created as a sheet-sourced
 * stub; matching rows are updated. Only non-empty cells are written, so the sheet
 * fills gaps without wiping values the console or IDX already set. Agent and
 * co-agent names are resolved to roster ids afterward for hub routing.
 */
export async function upsertListingsWorkflow(rows: unknown): Promise<ListingsImportResult> {
  if (!Array.isArray(rows)) throw new ApiError(400, 'listings must be an array of rows');
  let upserted = 0;
  let created = 0;

  await sql.begin(async (tx) => {
    const db = tx as unknown as typeof sql;
    for (const raw of rows as Row[]) {
      if (!raw || typeof raw !== 'object') continue;
      const address = str(pickKey(raw, ['address', 'Address']));
      if (!address) continue;

      const [row] = await db<Row[]>`
        insert into listings (address, source)
        values (${address}, 'sheet')
        on conflict (address_normalized) do update set updated_at = now()
        returning id, (xmax = 0) as inserted`;
      const id = String(row!.id);
      if (row!.inserted) created++;

      const body = dropEmpty(raw);
      delete body.address; // keep the canonical address; never overwrite from a re-key
      delete body.slug;
      const { scalar, uuid, json } = listingFields(body);
      delete (scalar as Row).slug;
      delete (scalar as Row).source;
      if (Object.keys(scalar).length || Object.keys(uuid).length || Object.keys(json).length)
        await applyUpdate('listings', id, { scalar, uuid, json }, db);
      upserted++;
    }
  });

  // Resolve agent/co-agent names → roster ids (only where not already linked).
  const linkPrimary = await sql`
    update listings l set agent_id = a.id
    from agents a
    where l.agent_id is null and l.agent_name is not null
      and lower(a.name) = lower(l.agent_name)`;
  const linkCo = await sql`
    update listings l set co_agent_id = a.id
    from agents a
    where l.co_agent_id is null and l.co_agent_name is not null
      and lower(a.name) = lower(l.co_agent_name)`;
  const linkedAgents =
    ((linkPrimary as unknown as { count?: number }).count ?? 0) +
    ((linkCo as unknown as { count?: number }).count ?? 0);

  return { ok: true, upserted, created, linkedAgents };
}
