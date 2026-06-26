-- ════════════════════════════════════════════════════════════════════════
-- 0008_views.sql — serving views that merge workflow + MLS for the API layer
-- ════════════════════════════════════════════════════════════════════════

-- listings_enriched: one row per ASG listing, merged with its best IDX match.
-- IDX match precedence: explicit idx_listing_id, then exact normalized address.
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
  -- cover: IDX CDN paints instantly; fall back to ASG cover
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
  -- IDX / MLS facts
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
  x.next_open_house                                             as next_open_house_date,
  l.raw,
  l.created_at,
  l.updated_at
from listings l
left join agents a on a.id = l.agent_id
left join lateral (
  select ix.*
  from idx_listings ix
  where ix.idx_listing_id = l.idx_listing_id
     or (l.idx_listing_id is null and ix.address_normalized = l.address_normalized)
  order by (ix.idx_listing_id = l.idx_listing_id) desc, ix.synced_at desc
  limit 1
) x on true;

-- listings_home: the homepage micro payload (?view=home)
create or replace view listings_home as
select
  id, address, neighborhood, status, listing_type, mls_area_major,
  list_price, beds, baths, sq_ft, cover_image, slug, agent_name
from listings_enriched
where archived = false
  and coalesce(status, '') not ilike 'closed%';

-- agent_volume: live pipeline volume aggregated from synced FUB deals
-- (a real-time complement to the periodic agent_stats snapshots).
create or replace view agent_volume as
select
  coalesce(d.agent_name, 'Unassigned')                                  as agent_name,
  count(*)                                                              as total_deals,
  count(*) filter (where d.status = 'won')                              as closed_deals,
  count(*) filter (where d.status = 'open')                             as pending_deals,
  coalesce(sum(d.price) filter (where d.status = 'won'), 0)             as closed_volume,
  coalesce(sum(d.price) filter (where d.status = 'open'), 0)            as pending_volume,
  coalesce(sum(d.price), 0)                                            as grand_total
from deals d
group by coalesce(d.agent_name, 'Unassigned');
