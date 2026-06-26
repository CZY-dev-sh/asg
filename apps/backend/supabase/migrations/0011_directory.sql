-- ── directory: make the Google Sheet "ASG Directory" the source of truth ──
-- The team keeps editing the sheet; Apps Script pushes every row to
-- POST /api/admin/directory, which upserts into this table. These columns
-- mirror the sheet so nothing is lost (the full row is also kept in `raw`).

alter table agents add column if not exists icon_photo_url               text;
alter table agents add column if not exists start_date                   date;
alter table agents add column if not exists birthday                     text;  -- "September 1" (no year), kept as typed
alter table agents add column if not exists admin_role                   text;
alter table agents add column if not exists landing_page_url             text;
alter table agents add column if not exists headshots_url                text;  -- Drive folder of portraits
alter table agents add column if not exists marketing_drive_url          text;
alter table agents add column if not exists buyer_guide_url              text;
alter table agents add column if not exists seller_guide_url            text;
alter table agents add column if not exists listing_presentation_url     text;
alter table agents add column if not exists business_card_url           text;
alter table agents add column if not exists buyer_guide_updated_at       text;
alter table agents add column if not exists seller_guide_updated_at      text;
alter table agents add column if not exists listing_presentation_updated_at text;
alter table agents add column if not exists business_card_updated_at     text;
alter table agents add column if not exists directory_synced_at          timestamptz;
