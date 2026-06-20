-- ════════════════════════════════════════════════════════════════════════
-- 0016_asana_listing_projects.sql — Asana listing project bookkeeping
-- ════════════════════════════════════════════════════════════════════════

alter table listings add column if not exists asana_project_url text;
alter table listings add column if not exists asana_seeded_at timestamptz;
alter table listings add column if not exists asana_portfolios jsonb not null default '[]'::jsonb;

alter table listing_requests add column if not exists assignee text;
