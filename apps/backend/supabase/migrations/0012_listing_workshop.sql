-- ════════════════════════════════════════════════════════════════════════
-- 0012_listing_workshop.sql — listing workshop lifecycle
--   • new-listing trigger from seller onboarding (lead_id linkage)
--   • co-listing agent (routes listings to agent personal hubs later)
--   • per-asset marketing status + delivery timestamps
--   • Acuity bookings linked to listings (photos scheduled/delivered)
--   • marketing requests as first-class rows that drive Asana project/tasks
--   • a per-listing activity timeline (client_visible flags the seller portal)
-- ════════════════════════════════════════════════════════════════════════

-- ── listings: workshop / asset / status / seller / integration columns ────
alter table listings add column if not exists co_agent_id                  uuid references agents(id) on delete set null;
alter table listings add column if not exists co_agent_name                text;
alter table listings add column if not exists lead_id                      uuid;
alter table listings add column if not exists asana_project_gid            text;
alter table listings add column if not exists compass_link                 text;

alter table listings add column if not exists fact_sheet_status            text;
alter table listings add column if not exists fact_sheet_requested_at      timestamptz;
alter table listings add column if not exists fact_sheet_delivered_at      timestamptz;
alter table listings add column if not exists open_house_materials_status        text;
alter table listings add column if not exists open_house_materials_requested_at  timestamptz;
alter table listings add column if not exists open_house_materials_delivered_at  timestamptz;
alter table listings add column if not exists matterport_delivered_at      timestamptz;
alter table listings add column if not exists floor_plan_delivered_at      timestamptz;
alter table listings add column if not exists video_delivered_at           timestamptz;
alter table listings add column if not exists services_booked              jsonb not null default '[]'::jsonb;
alter table listings add column if not exists photos_booking_url           text;

alter table listings add column if not exists seller_phone                 text;
alter table listings add column if not exists seller_questionnaire_sent    boolean not null default false;
alter table listings add column if not exists seller_questionnaire_sent_at timestamptz;

alter table listings add column if not exists marketing_ready              boolean not null default false;
alter table listings add column if not exists shared_with_agent_at         timestamptz;
alter table listings add column if not exists shared_by                    text;

create index if not exists listings_co_agent_idx on listings (co_agent_id);
create index if not exists listings_lead_idx on listings (lead_id);

-- ── acuity_appointments: tie a media booking to its listing ───────────────
alter table acuity_appointments add column if not exists listing_id       uuid references listings(id) on delete set null;
alter table acuity_appointments add column if not exists property_address text;
alter table acuity_appointments add column if not exists status           text;
alter table acuity_appointments add column if not exists booking_url      text;
create index if not exists acuity_appointments_listing_idx on acuity_appointments (listing_id);

-- ── asana_tasks: tie a synced task to a listing + the request it serves ───
alter table asana_tasks add column if not exists listing_id  uuid references listings(id) on delete set null;
alter table asana_tasks add column if not exists request_id  uuid;
create index if not exists asana_tasks_listing_idx on asana_tasks (listing_id);

-- ── listing_requests: marketing work requested from the console ───────────
-- Requests originate here (system of record). Creating one ensures the listing
-- has an Asana project and spawns a task; status flows back from Asana
-- (open task → in_progress, completed → delivered).
create table if not exists listing_requests (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null references listings(id) on delete cascade,
  kind            text not null,            -- open_house_materials | fact_sheet | photos | matterport | floor_plan | video | other
  status          text not null default 'requested',  -- requested | in_progress | delivered | cancelled
  materials       jsonb not null default '[]'::jsonb,
  notes           text,
  requested_by    text,
  requested_at    timestamptz not null default now(),
  delivered_at    timestamptz,
  asana_task_gid  text,
  asana_task_url  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists listing_requests_listing_idx on listing_requests (listing_id);
create index if not exists listing_requests_status_idx on listing_requests (status);
create trigger listing_requests_updated before update on listing_requests
  for each row execute function set_updated_at();

-- ── listing_activity: chronological history shown in the workshop ─────────
-- client_visible lets the upcoming seller portal stream a curated timeline
-- (milestones) without leaking internal notes.
create table if not exists listing_activity (
  id              bigint generated always as identity primary key,
  listing_id      uuid not null references listings(id) on delete cascade,
  ts              timestamptz not null default now(),
  type            text not null,            -- listing_created | photos_scheduled | photos_delivered | materials_requested | materials_delivered | asset_uploaded | asset_updated | status_changed | shared_with_agent | ...
  label           text,
  actor           text,
  meta            jsonb not null default '{}'::jsonb,
  client_visible  boolean not null default false
);
create index if not exists listing_activity_listing_idx on listing_activity (listing_id, ts desc);

-- ── recreate listings_enriched to expose the new columns + co-agent ───────
-- Appends new output columns at the end so CREATE OR REPLACE is satisfied.
create or replace view listings_enriched as
select
  l.id,
  l.address,
  l.address_normalized,
  l.slug,
  coalesce(l.neighborhood, x.neighborhood, x.area_major)        as neighborhood,
  l.agent_id,
  l.agent_name,
  a.slug                                                        as agent_slug,
  a.email                                                       as agent_email,
  l.status,
  l.phase_key,
  l.listing_type,
  coalesce(l.list_price, x.list_price)                          as list_price,
  l.list_date,
  coalesce(l.mls_number, x.mls_number)                          as mls_number,
  coalesce(l.beds,  x.beds)                                     as beds,
  coalesce(l.baths, x.baths)                                    as baths,
  coalesce(l.sq_ft, x.sq_ft)                                    as sq_ft,
  coalesce(x.cover_image_url, l.cover_image_url)                as cover_image,
  l.cover_image_url                                             as asg_cover_image,
  x.cover_image_url                                             as idx_cover_image,
  l.photos_folder_url,
  l.matterport_url,
  l.floor_plan_url,
  l.video_url,
  l.fact_sheet_url,
  l.booklet_url,
  l.open_house_materials_url,
  l.marketing_status,
  l.photos_status,
  l.photos_datetime,
  l.photos_delivered_at,
  l.matterport_status,
  l.floor_plan_status,
  l.video_status,
  l.seller_name,
  l.seller_email,
  l.asana_task_id,
  l.fub_deal_id,
  l.fub_stage,
  l.archived,
  l.email_sent,
  l.source,
  (x.idx_listing_id is not null)                               as idx_matched,
  x.idx_listing_id,
  x.status                                                      as idx_mls_status,
  x.details_url                                                 as idx_details_url,
  x.full_details_url                                            as mls_full_details_url,
  x.remarks                                                     as mls_remarks,
  x.city                                                        as mls_city,
  x.state                                                       as mls_state,
  x.zip                                                         as mls_zip,
  x.area_major                                                  as mls_area_major,
  x.property_type                                               as mls_property_type,
  x.latitude                                                    as mls_lat,
  x.longitude                                                   as mls_lng,
  x.photo_count                                                 as idx_photo_count,
  x.price_drop_amount,
  x.price_drop_date,
  x.next_open_house                                            as next_open_house_date,
  l.raw,
  l.created_at,
  l.updated_at,
  -- ── appended in 0012 ──
  l.co_agent_id,
  l.co_agent_name,
  b.slug                                                        as co_agent_slug,
  b.email                                                       as co_agent_email,
  l.lead_id,
  l.asana_project_gid,
  l.compass_link,
  l.fact_sheet_status,
  l.fact_sheet_requested_at,
  l.fact_sheet_delivered_at,
  l.open_house_materials_status,
  l.open_house_materials_requested_at,
  l.open_house_materials_delivered_at,
  l.matterport_delivered_at,
  l.floor_plan_delivered_at,
  l.video_delivered_at,
  l.services_booked,
  l.photos_booking_id,
  l.photos_booking_url,
  l.seller_phone,
  l.seller_questionnaire_content,
  l.seller_questionnaire_sent,
  l.seller_questionnaire_sent_at,
  l.marketing_ready,
  l.shared_with_agent_at,
  l.shared_by
from listings l
left join agents a on a.id = l.agent_id
left join agents b on b.id = l.co_agent_id
left join lateral (
  select ix.*
  from idx_listings ix
  where ix.idx_listing_id = l.idx_listing_id
     or (l.idx_listing_id is null and ix.address_normalized = l.address_normalized)
  order by (ix.idx_listing_id = l.idx_listing_id) desc, ix.synced_at desc
  limit 1
) x on true;

-- ── RLS for the new tables (defense-in-depth; the API uses service-role) ──
do $migration$
begin
  if not exists (select 1 from pg_proc where proname = 'is_admin') then
    raise notice 'is_admin() not found — skipping listing_requests/listing_activity policies (run 0009 first)';
    return;
  end if;

  execute $sql$ alter table listing_requests enable row level security $sql$;
  execute $sql$ alter table listing_activity enable row level security $sql$;

  if not exists (select 1 from pg_policies where tablename = 'listing_requests' and policyname = 'listing_requests_admin_write') then
    execute $sql$ create policy listing_requests_admin_write on listing_requests for all
                  using (is_admin()) with check (is_admin()) $sql$;
  end if;
  if not exists (select 1 from pg_policies where tablename = 'listing_requests' and policyname = 'listing_requests_agent_read') then
    execute $sql$ create policy listing_requests_agent_read on listing_requests for select
                  using (exists (select 1 from listings l where l.id = listing_requests.listing_id
                                 and (l.agent_id = current_agent_id() or l.co_agent_id = current_agent_id()))) $sql$;
  end if;

  if not exists (select 1 from pg_policies where tablename = 'listing_activity' and policyname = 'listing_activity_admin_write') then
    execute $sql$ create policy listing_activity_admin_write on listing_activity for all
                  using (is_admin()) with check (is_admin()) $sql$;
  end if;
  if not exists (select 1 from pg_policies where tablename = 'listing_activity' and policyname = 'listing_activity_agent_read') then
    execute $sql$ create policy listing_activity_agent_read on listing_activity for select
                  using (exists (select 1 from listings l where l.id = listing_activity.listing_id
                                 and (l.agent_id = current_agent_id() or l.co_agent_id = current_agent_id()))) $sql$;
  end if;
end
$migration$;
