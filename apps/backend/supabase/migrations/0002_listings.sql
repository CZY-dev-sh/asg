-- ════════════════════════════════════════════════════════════════════════
-- 0002_listings.sql — listings (workflow), IDX/MLS mirror, photos, open houses
-- ════════════════════════════════════════════════════════════════════════

-- ── listings: ASG system-of-record for workflow + marketing state ─────────
-- One row per ASG-managed property. MLS facts are merged from idx_listings
-- through the listings_enriched view (by idx_listing_id or normalized address).
create table listings (
  id                       uuid primary key default gen_random_uuid(),
  address                  text not null,
  address_normalized       text generated always as (normalize_address(address)) stored,
  slug                     text unique,
  neighborhood             text,
  agent_id                 uuid references agents(id) on delete set null,
  agent_name               text,
  status                   text default 'Active',         -- Active | Under Contract | Closed | ...
  phase_key                text,                           -- secured | media | live | underContract | closed
  listing_type             text,                           -- Sale | Rental | ...
  list_price               numeric,
  list_date                date,
  listing_agreement_date   date,
  smo_credit               text,
  mls_number               text,
  beds                     numeric,
  baths                    numeric,
  sq_ft                    integer,

  -- media (ASG-produced)
  cover_image_url          text,
  photos_folder_url        text,            -- Google Drive folder url
  matterport_url           text,
  floor_plan_url           text,
  video_url                text,
  fact_sheet_url           text,
  booklet_url              text,
  open_house_materials_url text,
  story_url                text,
  sign_url                 text,

  -- marketing workflow status
  marketing_status         text,
  photos_status            text,
  photos_datetime          timestamptz,
  photos_booking_id        text,
  photos_delivered_at      timestamptz,
  matterport_status        text,
  floor_plan_status        text,
  video_status             text,

  -- seller / correlation
  seller_name              text,
  seller_email             text,
  seller_questionnaire_content text,
  asana_task_id            text,
  fub_deal_id              text,
  fub_stage                text,

  -- IDX link (resolved during sync; view also falls back to address join)
  idx_listing_id           text,

  archived                 boolean not null default false,
  email_sent               boolean not null default false,
  source                   text default 'sheet',           -- sheet | idx | manual
  raw                      jsonb not null default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create unique index listings_address_norm_uidx on listings (address_normalized);
create index on listings (status);
create index on listings (archived);
create index on listings (agent_id);
create index on listings (idx_listing_id);
create index listings_address_trgm on listings using gin (address_normalized gin_trgm_ops);
create trigger listings_updated before update on listings
  for each row execute function set_updated_at();

-- ── idx_listings: raw MLS mirror from IDX Broker / Elm Street ─────────────
create table idx_listings (
  idx_listing_id      text primary key,            -- IDX listingID
  feed                text,                         -- featured | soldpending | supplemental
  mls_number          text,
  address             text,
  address_normalized  text generated always as (normalize_address(address)) stored,
  city                text,
  state               text,
  zip                 text,
  area_major          text,
  neighborhood        text,
  status              text,                         -- IDX propStatus / mls status
  property_type       text,
  list_price          numeric,
  beds                numeric,
  baths               numeric,
  sq_ft               integer,
  year_built          integer,
  latitude            numeric,
  longitude           numeric,
  remarks             text,
  cover_image_url     text,                         -- image.firstUrl
  photo_count         integer default 0,
  details_url         text,
  full_details_url    text,
  price_drop_amount   numeric,
  price_drop_date     date,
  next_open_house     timestamptz,
  raw                 jsonb not null default '{}'::jsonb,
  synced_at           timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_listings_address_norm on idx_listings (address_normalized);
create index idx_listings_address_trgm on idx_listings using gin (address_normalized gin_trgm_ops);
create index on idx_listings (status);
create trigger idx_listings_updated before update on idx_listings
  for each row execute function set_updated_at();

-- ── listing_photos: unified photo store (IDX CDN + Drive → Supabase) ──────
create type photo_source as enum ('idx', 'drive', 'manual');

create table listing_photos (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid references listings(id) on delete cascade,
  idx_listing_id  text references idx_listings(idx_listing_id) on delete cascade,
  source          photo_source not null,
  position        integer not null default 0,
  caption         text,
  original_url    text,            -- source URL (IDX CDN or Drive)
  drive_file_id   text,
  storage_path    text,            -- path inside Supabase Storage bucket
  public_url      text,            -- served URL (Supabase public or original fallback)
  thumb_url       text,
  content_type    text,
  bytes           bigint,
  width           integer,
  height          integer,
  checksum        text,
  mirrored        boolean not null default false,  -- true once copied into Supabase Storage
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index listing_photos_drive_uidx
  on listing_photos (listing_id, drive_file_id) where drive_file_id is not null;
create unique index listing_photos_idx_uidx
  on listing_photos (idx_listing_id, position) where idx_listing_id is not null and source = 'idx';
create index on listing_photos (listing_id, position);
create trigger listing_photos_updated before update on listing_photos
  for each row execute function set_updated_at();

-- ── open houses ───────────────────────────────────────────────────────────
create table open_houses (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid references listings(id) on delete cascade,
  idx_listing_id  text references idx_listings(idx_listing_id) on delete cascade,
  starts_at       timestamptz,
  ends_at         timestamptz,
  source          text default 'idx',
  raw             jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index on open_houses (listing_id);
create index on open_houses (starts_at);
