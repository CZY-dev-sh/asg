import { sql, j } from '../db/client.js';
import { uploadObject, supabase } from '../storage.js';
import { slugify, parseNumber, parseBool, parseDate, parseDateTime } from '../util/text.js';

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
  starts_at: parseDateTime,
  ends_at: parseDateTime,
  published_at: parseDateTime,
  archived: parseBool,
  email_sent: parseBool,
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
  matterportStatus: 'matterport_status',
  floorPlanStatus: 'floor_plan_status',
  videoStatus: 'video_status',
  sellerName: 'seller_name',
  sellerEmail: 'seller_email',
  asanaTaskId: 'asana_task_id',
  fubDealId: 'fub_deal_id',
  fubStage: 'fub_stage',
  idxListingId: 'idx_listing_id',
  archived: 'archived',
  emailSent: 'email_sent',
};

/** Map listing body → {scalar, uuid} column groups (shared by create/update). */
function listingFields(body: Row): { scalar: Row; uuid: Record<string, unknown> } {
  const scalar = pick(body, LISTING_SCALARS);
  const uuid: Record<string, unknown> = {};
  if (body.agentId !== undefined) uuid.agent_id = body.agentId;
  return { scalar, uuid };
}

export async function updateListing(id: string, body: Row): Promise<Row> {
  const existing = await fetchOne('listings', id);
  if (!existing) throw new ApiError(404, 'listing not found');
  const { scalar, uuid } = listingFields(body);
  if (!Object.keys(scalar).length && !Object.keys(uuid).length)
    throw new ApiError(400, 'no writable fields supplied');
  await applyUpdate('listings', id, { scalar, uuid });
  return (await fetchOne('listings', id))!;
}

export async function createListing(body: Row): Promise<Row> {
  const address = String(body.address ?? '').trim();
  if (!address) throw new ApiError(400, 'address required');
  const slug = body.slug ? slugify(String(body.slug)) : slugify(address) || null;
  const rest = { ...body };
  delete rest.slug;
  const { scalar, uuid } = listingFields(rest);
  let id: string;
  try {
    // One transaction: stub insert + field updates roll back together.
    id = await sql.begin(async (tx) => {
      const [row] = await tx<Row[]>`
        insert into listings (address, slug, source) values (${address}, ${slug}, 'manual')
        returning id`;
      const newId = String(row!.id);
      if (Object.keys(scalar).length || Object.keys(uuid).length)
        await applyUpdate('listings', newId, { scalar, uuid }, tx as unknown as typeof sql);
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
  body: { fullName?: unknown; phone?: unknown },
): Promise<Row | null> {
  const fullName = body.fullName == null ? null : String(body.fullName);
  const phone = body.phone == null ? null : String(body.phone);
  if (fullName == null && phone == null) throw new ApiError(400, 'nothing to update');
  await sql`
    update profiles set
      full_name = coalesce(${fullName}, full_name),
      phone = coalesce(${phone}, phone)
    where id = ${userId}::uuid`;
  const [row] = await sql<Row[]>`
    select id, email, full_name, phone, role, agent_id, contact_id from profiles where id = ${userId}::uuid`;
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
