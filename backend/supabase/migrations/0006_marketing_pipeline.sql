-- ════════════════════════════════════════════════════════════════════════
-- 0006_marketing_pipeline.sql — Asana, Acuity, marketing emails, drive
-- folders, pipeline deals + agent stats
-- ════════════════════════════════════════════════════════════════════════

-- ── Asana marketing tasks ─────────────────────────────────────────────────
create table asana_tasks (
  id            text primary key,        -- Asana gid
  title         text,
  agent         text,
  type          text,                    -- Listing Photos | Floor Plan | ...
  status        text default 'Open',     -- Open | Completed
  completed     boolean not null default false,
  created_at_asana timestamptz,
  due_on        date,
  completed_at  timestamptz,
  url           text,
  raw           jsonb not null default '{}'::jsonb,
  synced_at     timestamptz not null default now()
);
create index on asana_tasks (status);
create index on asana_tasks (agent);

-- ── Acuity photo-shoot bookings ───────────────────────────────────────────
create table acuity_appointments (
  id            text primary key,        -- Acuity appointment id
  title         text,
  agent         text,
  starts_at     timestamptz,
  ends_at       timestamptz,
  client_name   text,
  calendar_id   text,
  appointment_type text,
  raw           jsonb not null default '{}'::jsonb,
  synced_at     timestamptz not null default now()
);
create index on acuity_appointments (starts_at);

-- ── Marketing output (Gmail scan) ─────────────────────────────────────────
create table marketing_emails (
  id            text primary key,        -- Gmail message id
  thread_id     text,
  subject       text,
  category      text,
  person        text,
  property      text,
  direction     text,                    -- sent | received
  ts            timestamptz,
  raw           jsonb not null default '{}'::jsonb,
  synced_at     timestamptz not null default now()
);
create index on marketing_emails (ts desc);
create index on marketing_emails (category);

-- ── Drive folders (recent listing photo folders + asset roots) ────────────
create type drive_folder_kind as enum ('listing', 'agent', 'brand');

create table drive_folders (
  id            text primary key,        -- Drive folder id
  name          text,
  parent_id     text,
  kind          drive_folder_kind not null default 'listing',
  modified_at   timestamptz,
  web_url       text,
  raw           jsonb not null default '{}'::jsonb,
  synced_at     timestamptz not null default now()
);
create index on drive_folders (kind, modified_at desc);

-- ── Pipeline deals (published buyer/seller CSVs: Recent Deals / Stage Health) ─
create table pipeline_deals (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null,           -- buyer | seller
  agent_name    text,
  address       text,
  price         numeric,
  stage         text,
  close_date    date,
  photo_url     text,
  raw           jsonb not null default '{}'::jsonb,
  synced_at     timestamptz not null default now()
);
create index on pipeline_deals (kind);
create index on pipeline_deals (agent_name);

-- ── Agent stats (volume summary from the "ASG Deals" workbook tabs) ───────
create table agent_stats (
  agent_name      text not null,
  period          text not null,         -- ytd2026 | allTime
  grand_total     numeric not null default 0,
  total_deals     integer not null default 0,
  closed_volume   numeric not null default 0,
  closed_deals    integer not null default 0,
  pending_volume  numeric not null default 0,
  pending_deals   integer not null default 0,
  buy_pct         numeric,
  total_zillow    numeric,
  raw             jsonb not null default '{}'::jsonb,
  synced_at       timestamptz not null default now(),
  primary key (agent_name, period)
);
