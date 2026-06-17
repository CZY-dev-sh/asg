import { sql } from '../db/client.js';
import { extractDriveId } from '../connectors/drive.js';

export interface PhotoOut {
  url: string;
  thumbUrl: string;
  caption: string;
  order: number;
  source: string;
}

// Mirrors the enriched listing object the ASG surfaces consume.
export interface ListingOut {
  id: string;
  address: string;
  neighborhood: string | null;
  agent: string | null;
  agentEmail: string | null;
  agentSlug: string | null;
  status: string | null;
  phaseKey: string | null;
  listingType: string | null;
  listPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqFt: number | null;
  coverImage: string | null;
  idxCoverImage: string | null;
  photos: string | null;
  matterport: string | null;
  floorPlan: string | null;
  video: string | null;
  factSheet: string | null;
  openHouse: string | null;
  marketingStatus: string | null;
  photosStatus: string | null;
  photosDatetime: string | null;
  photosDeliveredAt: string | null;
  matterportStatus: string | null;
  floorPlanStatus: string | null;
  videoStatus: string | null;
  idxMatched: boolean;
  idxListingId: string | null;
  idxMlsStatus: string | null;
  idxDetailsUrl: string | null;
  mlsRemarks: string | null;
  mlsCity: string | null;
  mlsZip: string | null;
  mlsAreaMajor: string | null;
  mlsLat: number | null;
  mlsLng: number | null;
  mlsFullDetailsUrl: string | null;
  mlsPhotos: PhotoOut[];
  galleryPhotos: PhotoOut[];
  openHouses: Array<{ startsAt: string | null; endsAt: string | null }>;
  nextOpenHouseDate: string | null;
  priceDropAmount: number | null;
  priceDropDate: string | null;
  emailSent: boolean;
  archived: boolean;
  fubDealId: string | null;
  fubStage: string | null;
  // ── workshop (0012) ──
  source: string | null;
  mlsNumber: string | null;
  listDate: string | null;
  compassLink: string | null;
  bookletUrl: string | null;
  coListAgentName: string | null;
  coAgentSlug: string | null;
  coAgentEmail: string | null;
  leadId: string | null;
  asanaProjectGid: string | null;
  factSheetStatus: string | null;
  factSheetRequestedAt: string | null;
  factSheetDeliveredAt: string | null;
  openHouseMaterialsStatus: string | null;
  openHouseMaterialsRequestedAt: string | null;
  openHouseMaterialsDeliveredAt: string | null;
  matterportDeliveredAt: string | null;
  floorPlanDeliveredAt: string | null;
  videoDeliveredAt: string | null;
  servicesBooked: unknown[];
  photosBookingId: string | null;
  photosBookingUrl: string | null;
  sellerName: string | null;
  sellerEmail: string | null;
  sellerPhone: string | null;
  sellerQuestionnaireContent: string | null;
  sellerQuestionnaireSent: boolean;
  marketingReady: boolean;
  sharedWithAgentAt: string | null;
  sharedBy: string | null;
}

type Row = Record<string, unknown>;

const num = (v: unknown): number | null => (v == null ? null : Number(v));
const iso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : v == null ? null : String(v);

function mapRow(r: Row, mls: PhotoOut[], gallery: PhotoOut[]): ListingOut {
  return {
    id: String(r.id),
    address: String(r.address ?? ''),
    neighborhood: (r.neighborhood as string) ?? null,
    agent: (r.agent_name as string) ?? null,
    agentEmail: (r.agent_email as string) ?? null,
    agentSlug: (r.agent_slug as string) ?? null,
    status: (r.status as string) ?? null,
    phaseKey: (r.phase_key as string) ?? null,
    listingType: (r.listing_type as string) ?? null,
    listPrice: num(r.list_price),
    beds: num(r.beds),
    baths: num(r.baths),
    sqFt: num(r.sq_ft),
    coverImage: (r.cover_image as string) ?? null,
    idxCoverImage: (r.idx_cover_image as string) ?? null,
    photos: (r.photos_folder_url as string) ?? null,
    matterport: (r.matterport_url as string) ?? null,
    floorPlan: (r.floor_plan_url as string) ?? null,
    video: (r.video_url as string) ?? null,
    factSheet: (r.fact_sheet_url as string) ?? null,
    openHouse: (r.open_house_materials_url as string) ?? null,
    marketingStatus: (r.marketing_status as string) ?? null,
    photosStatus: (r.photos_status as string) ?? null,
    photosDatetime: iso(r.photos_datetime),
    photosDeliveredAt: iso(r.photos_delivered_at),
    matterportStatus: (r.matterport_status as string) ?? null,
    floorPlanStatus: (r.floor_plan_status as string) ?? null,
    videoStatus: (r.video_status as string) ?? null,
    idxMatched: Boolean(r.idx_matched),
    idxListingId: (r.idx_listing_id as string) ?? null,
    idxMlsStatus: (r.idx_mls_status as string) ?? null,
    idxDetailsUrl: (r.idx_details_url as string) ?? null,
    mlsRemarks: (r.mls_remarks as string) ?? null,
    mlsCity: (r.mls_city as string) ?? null,
    mlsZip: (r.mls_zip as string) ?? null,
    mlsAreaMajor: (r.mls_area_major as string) ?? null,
    mlsLat: num(r.mls_lat),
    mlsLng: num(r.mls_lng),
    mlsFullDetailsUrl: (r.mls_full_details_url as string) ?? null,
    mlsPhotos: mls,
    galleryPhotos: gallery,
    openHouses: [],
    nextOpenHouseDate: iso(r.next_open_house_date),
    priceDropAmount: num(r.price_drop_amount),
    priceDropDate: iso(r.price_drop_date),
    emailSent: Boolean(r.email_sent),
    archived: Boolean(r.archived),
    fubDealId: (r.fub_deal_id as string) ?? null,
    fubStage: (r.fub_stage as string) ?? null,
    // ── workshop (0012) ──
    source: (r.source as string) ?? null,
    mlsNumber: (r.mls_number as string) ?? null,
    listDate: iso(r.list_date),
    compassLink: (r.compass_link as string) ?? null,
    bookletUrl: (r.booklet_url as string) ?? null,
    coListAgentName: (r.co_agent_name as string) ?? null,
    coAgentSlug: (r.co_agent_slug as string) ?? null,
    coAgentEmail: (r.co_agent_email as string) ?? null,
    leadId: (r.lead_id as string) ?? null,
    asanaProjectGid: (r.asana_project_gid as string) ?? null,
    factSheetStatus: (r.fact_sheet_status as string) ?? null,
    factSheetRequestedAt: iso(r.fact_sheet_requested_at),
    factSheetDeliveredAt: iso(r.fact_sheet_delivered_at),
    openHouseMaterialsStatus: (r.open_house_materials_status as string) ?? null,
    openHouseMaterialsRequestedAt: iso(r.open_house_materials_requested_at),
    openHouseMaterialsDeliveredAt: iso(r.open_house_materials_delivered_at),
    matterportDeliveredAt: iso(r.matterport_delivered_at),
    floorPlanDeliveredAt: iso(r.floor_plan_delivered_at),
    videoDeliveredAt: iso(r.video_delivered_at),
    servicesBooked: Array.isArray(r.services_booked) ? (r.services_booked as unknown[]) : [],
    photosBookingId: (r.photos_booking_id as string) ?? null,
    photosBookingUrl: (r.photos_booking_url as string) ?? null,
    sellerName: (r.seller_name as string) ?? null,
    sellerEmail: (r.seller_email as string) ?? null,
    sellerPhone: (r.seller_phone as string) ?? null,
    sellerQuestionnaireContent: (r.seller_questionnaire_content as string) ?? null,
    sellerQuestionnaireSent: Boolean(r.seller_questionnaire_sent),
    marketingReady: Boolean(r.marketing_ready),
    sharedWithAgentAt: iso(r.shared_with_agent_at),
    sharedBy: (r.shared_by as string) ?? null,
  };
}

async function loadPhotos(
  listingIds: string[],
  idxIds: string[],
): Promise<{ byListing: Map<string, PhotoOut[]>; byIdx: Map<string, PhotoOut[]> }> {
  const byListing = new Map<string, PhotoOut[]>();
  const byIdx = new Map<string, PhotoOut[]>();
  if (listingIds.length) {
    const rows = await sql<Row[]>`
      select listing_id, public_url, thumb_url, caption, position, source
      from listing_photos
      where listing_id = any(${listingIds}) and source <> 'idx'
      order by position asc
    `;
    for (const r of rows) {
      const key = String(r.listing_id);
      const arr = byListing.get(key) ?? [];
      arr.push({
        url: String(r.public_url ?? ''),
        thumbUrl: String(r.thumb_url ?? r.public_url ?? ''),
        caption: (r.caption as string) ?? '',
        order: Number(r.position) || 0,
        source: String(r.source),
      });
      byListing.set(key, arr);
    }
  }
  if (idxIds.length) {
    const rows = await sql<Row[]>`
      select idx_listing_id, public_url, thumb_url, caption, position
      from listing_photos
      where idx_listing_id = any(${idxIds}) and source = 'idx'
      order by position asc
    `;
    for (const r of rows) {
      const key = String(r.idx_listing_id);
      const arr = byIdx.get(key) ?? [];
      arr.push({
        url: String(r.public_url ?? ''),
        thumbUrl: String(r.thumb_url ?? r.public_url ?? ''),
        caption: (r.caption as string) ?? '',
        order: Number(r.position) || 0,
        source: 'idx',
      });
      byIdx.set(key, arr);
    }
  }
  return { byListing, byIdx };
}

async function attachPhotos(rows: Row[]): Promise<ListingOut[]> {
  const listingIds = rows.map((r) => String(r.id));
  const idxIds = rows.map((r) => r.idx_listing_id).filter(Boolean).map(String);
  const { byListing, byIdx } = await loadPhotos(listingIds, idxIds);
  return rows.map((r) =>
    mapRow(
      r,
      byIdx.get(String(r.idx_listing_id)) ?? [],
      byListing.get(String(r.id)) ?? [],
    ),
  );
}

export async function getActive(): Promise<ListingOut[]> {
  const rows = await sql<Row[]>`
    select * from listings_enriched
    where archived = false and coalesce(status,'') not ilike 'closed%'
    order by list_price desc nulls last
  `;
  return attachPhotos(rows);
}

export async function getArchive(): Promise<ListingOut[]> {
  const rows = await sql<Row[]>`
    select * from listings_enriched
    where archived = true or coalesce(status,'') ilike 'closed%'
    order by updated_at desc
  `;
  return attachPhotos(rows);
}

export async function getAll(): Promise<ListingOut[]> {
  const rows = await sql<Row[]>`select * from listings_enriched order by updated_at desc`;
  return attachPhotos(rows);
}

export async function getHome(): Promise<Array<Record<string, unknown>>> {
  const rows = await sql<Row[]>`select * from listings_home order by list_price desc nulls last limit 24`;
  return rows.map((r) => ({
    id: String(r.id),
    address: r.address,
    neighborhood: r.neighborhood,
    status: r.status,
    listingType: r.listing_type,
    areaMajor: r.mls_area_major,
    listPrice: num(r.list_price),
    beds: num(r.beds),
    baths: num(r.baths),
    sqFt: num(r.sq_ft),
    coverImage: r.cover_image,
    slug: r.slug,
    agent: r.agent_name,
  }));
}

export async function getListingByAddress(address: string): Promise<ListingOut | null> {
  const norm = address
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const rows = await sql<Row[]>`
    select * from listings_enriched
    where address_normalized = ${norm} or address_normalized % ${norm}
    order by (address_normalized = ${norm}) desc
    limit 1
  `;
  if (rows.length === 0) return null;
  const [out] = await attachPhotos(rows);
  return out ?? null;
}

export async function getPhotosFor(params: {
  address?: string;
  listingId?: string;
  idxListingId?: string;
  folderId?: string;
}): Promise<{ coverImage: string | null; photos: PhotoOut[]; address: string | null }> {
  let listingId = params.listingId ?? null;
  let idxListingId = params.idxListingId ?? null;
  let address: string | null = null;
  let cover: string | null = null;

  if (!listingId && params.address) {
    const norm = params.address
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const [row] = await sql<Row[]>`
      select id, idx_listing_id, address, cover_image
      from listings_enriched
      where address_normalized = ${norm} or address_normalized % ${norm}
      order by (address_normalized = ${norm}) desc limit 1
    `;
    if (row) {
      listingId = String(row.id);
      idxListingId = (row.idx_listing_id as string) ?? null;
      address = String(row.address);
      cover = (row.cover_image as string) ?? null;
    }
  }

  const folderId = extractDriveId(params.folderId);
  const photos = await sql<Row[]>`
    select public_url, thumb_url, caption, position, source
    from listing_photos
    where (${listingId}::uuid is not null and listing_id = ${listingId}::uuid)
       or (${idxListingId}::text is not null and idx_listing_id = ${idxListingId})
    order by source = 'drive' desc, position asc
  `;
  void folderId;
  return {
    address,
    coverImage: cover,
    photos: photos.map((r) => ({
      url: String(r.public_url ?? ''),
      thumbUrl: String(r.thumb_url ?? r.public_url ?? ''),
      caption: (r.caption as string) ?? '',
      order: Number(r.position) || 0,
      source: String(r.source),
    })),
  };
}

/** Listings where the agent is the primary OR co-listing agent (by slug). */
export async function getForAgent(slug: string): Promise<ListingOut[]> {
  const rows = await sql<Row[]>`
    select * from listings_enriched
    where agent_slug = ${slug} or co_agent_slug = ${slug}
    order by archived asc, list_price desc nulls last
  `;
  return attachPhotos(rows);
}

export interface AppointmentOut {
  id: string;
  title: string | null;
  type: string | null;
  agent: string | null;
  clientName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: string | null;
  bookingUrl: string | null;
}

export async function getAppointments(listingId: string): Promise<AppointmentOut[]> {
  const rows = await sql<Row[]>`
    select id, title, agent, client_name, appointment_type, starts_at, ends_at, status, booking_url
    from acuity_appointments where listing_id = ${listingId}::uuid order by starts_at asc nulls last
  `;
  return rows.map((r) => ({
    id: String(r.id),
    title: (r.title as string) ?? null,
    type: (r.appointment_type as string) ?? null,
    agent: (r.agent as string) ?? null,
    clientName: (r.client_name as string) ?? null,
    startsAt: iso(r.starts_at),
    endsAt: iso(r.ends_at),
    status: (r.status as string) ?? null,
    bookingUrl: (r.booking_url as string) ?? null,
  }));
}

export interface RequestOut {
  id: string;
  kind: string;
  status: string;
  materials: unknown[];
  notes: string | null;
  requestedBy: string | null;
  requestedAt: string | null;
  deliveredAt: string | null;
  asanaTaskUrl: string | null;
}

export async function getRequests(listingId: string): Promise<RequestOut[]> {
  const rows = await sql<Row[]>`
    select id, kind, status, materials, notes, requested_by, requested_at, delivered_at, asana_task_url
    from listing_requests where listing_id = ${listingId}::uuid order by requested_at desc
  `;
  return rows.map((r) => ({
    id: String(r.id),
    kind: String(r.kind),
    status: String(r.status),
    materials: Array.isArray(r.materials) ? (r.materials as unknown[]) : [],
    notes: (r.notes as string) ?? null,
    requestedBy: (r.requested_by as string) ?? null,
    requestedAt: iso(r.requested_at),
    deliveredAt: iso(r.delivered_at),
    asanaTaskUrl: (r.asana_task_url as string) ?? null,
  }));
}

export interface ActivityOut {
  id: string;
  ts: string | null;
  type: string;
  label: string | null;
  actor: string | null;
  meta: Record<string, unknown>;
  clientVisible: boolean;
}

export async function getActivity(
  listingId: string,
  opts: { clientVisibleOnly?: boolean; limit?: number } = {},
): Promise<ActivityOut[]> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const rows = await sql<Row[]>`
    select id, ts, type, label, actor, meta, client_visible
    from listing_activity
    where listing_id = ${listingId}::uuid
      and (${opts.clientVisibleOnly ? true : false} = false or client_visible = true)
    order by ts desc
    limit ${limit}
  `;
  return rows.map((r) => ({
    id: String(r.id),
    ts: iso(r.ts),
    type: String(r.type),
    label: (r.label as string) ?? null,
    actor: (r.actor as string) ?? null,
    meta: (r.meta as Record<string, unknown>) ?? {},
    clientVisible: Boolean(r.client_visible),
  }));
}

/** Listing + everything the workshop renders in one call. */
export async function getListingDetail(listingId: string): Promise<
  (ListingOut & { appointments: AppointmentOut[]; requests: RequestOut[]; activity: ActivityOut[] }) | null
> {
  const rows = await sql<Row[]>`select * from listings_enriched where id = ${listingId}::uuid limit 1`;
  if (rows.length === 0) return null;
  const [listing] = await attachPhotos(rows);
  if (!listing) return null;
  const [appointments, requests, activity] = await Promise.all([
    getAppointments(listingId),
    getRequests(listingId),
    getActivity(listingId),
  ]);
  return { ...listing, appointments, requests, activity };
}

export async function getIdxSyncStatus() {
  const [meta] = await sql<Row[]>`
    select max(synced_at) as last_sync, count(*)::int as row_count from idx_listings
  `;
  const [run] = await sql<Row[]>`
    select status, finished_at, records, error from sync_runs
    where source = 'idx' order by started_at desc limit 1
  `;
  return {
    success: true,
    lastSync: iso(meta?.last_sync),
    rowCount: Number(meta?.row_count ?? 0),
    sheetName: 'idx_listings',
    lastRun: run
      ? { status: run.status, finishedAt: iso(run.finished_at), records: Number(run.records ?? 0), error: run.error ?? null }
      : null,
  };
}
