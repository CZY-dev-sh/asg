-- ════════════════════════════════════════════════════════════════════════
-- 0004_hub_content.sql — hub data: events, updates, reviews, landing pages
-- ════════════════════════════════════════════════════════════════════════

create table team_events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  starts_at    timestamptz,
  ends_at      timestamptz,
  all_day      boolean not null default false,
  location     text,
  description  text,
  audience     text,              -- all | senior | junior | admin
  url          text,
  raw          jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on team_events (starts_at);
create trigger team_events_updated before update on team_events
  for each row execute function set_updated_at();

create table team_updates (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  body          text,
  published_at  timestamptz not null default now(),
  audience      text,
  pinned        boolean not null default false,
  author        text,
  raw           jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on team_updates (published_at desc);
create trigger team_updates_updated before update on team_updates
  for each row execute function set_updated_at();

create table reviews (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid references agents(id) on delete set null,
  agent_name    text,
  author        text,
  rating        numeric,
  body          text,
  source        text,             -- Zillow | Google | Compass | ...
  published_at  timestamptz,
  raw           jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index on reviews (agent_id);

-- landing pages: per-agent landing config (general/buyer/seller variants)
create table landing_pages (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null,
  page_type         text not null default 'general',   -- general | buyer | seller
  agent_id          uuid references agents(id) on delete set null,
  agent_name        text,
  hero              jsonb not null default '{}'::jsonb,
  sections          jsonb not null default '[]'::jsonb,
  stats             jsonb not null default '{}'::jsonb,
  reviews           jsonb not null default '[]'::jsonb,
  idx_config        jsonb not null default '{}'::jsonb,
  curated_listings  jsonb not null default '[]'::jsonb,
  raw               jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (slug, page_type)
);
create trigger landing_pages_updated before update on landing_pages
  for each row execute function set_updated_at();
