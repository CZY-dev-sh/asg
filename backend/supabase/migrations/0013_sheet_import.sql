-- ════════════════════════════════════════════════════════════════════════
-- 0013_sheet_import.sql — idempotent keys for Events/Updates sheet imports
-- ════════════════════════════════════════════════════════════════════════
-- The "Events" and "Updates" tabs of the Hub Data sheet are pushed to the
-- backend (like the Directory). They have no natural primary key, so we add a
-- stable external_key (derived in Apps Script from title + date) to upsert on,
-- plus a source tag for provenance. Console-created rows keep external_key null
-- and are never touched by a sheet push.

alter table team_events  add column if not exists external_key text;
alter table team_events  add column if not exists source       text default 'manual';
alter table team_updates add column if not exists external_key text;
alter table team_updates add column if not exists source       text default 'manual';

create unique index if not exists team_events_external_key_uidx
  on team_events (external_key) where external_key is not null;
create unique index if not exists team_updates_external_key_uidx
  on team_updates (external_key) where external_key is not null;
