-- ════════════════════════════════════════════════════════════════════════
-- 0001_init.sql — extensions, shared enums, agents/directory, sync bookkeeping
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;     -- gen_random_uuid()
create extension if not exists pg_trgm;       -- fuzzy address matching

-- ── shared helper: updated_at trigger ────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── address normalization (used to merge IDX + workflow listings) ─────────
create or replace function normalize_address(addr text)
returns text language sql immutable as $$
  select nullif(
    regexp_replace(
      regexp_replace(lower(coalesce(addr, '')), '[^a-z0-9]+', ' ', 'g'),
      '\s+', ' ', 'g'
    ),
  '');
$$;

-- ── agents / team directory ──────────────────────────────────────────────
create type agent_tier as enum ('senior', 'junior', 'admin');

create table agents (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  name               text not null,
  email              text unique,
  phone              text,
  fub_phone          text,
  fub_user_id        text,
  tier               agent_tier not null default 'junior',
  role               text,
  dept               text,
  hours              text,
  headshot_url       text,
  headshot_path      text,            -- Supabase Storage path
  bio                text,
  active             boolean not null default true,
  seniority_rank     integer,
  computed_tier      text,
  next_birthday      date,
  drive_folder_id    text,
  quick_links        jsonb not null default '[]'::jsonb,
  raw                jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on agents (lower(email));
create index on agents (tier);
create trigger agents_updated before update on agents
  for each row execute function set_updated_at();

-- ── sync bookkeeping (every ingestion run is recorded) ────────────────────
create table sync_runs (
  id           uuid primary key default gen_random_uuid(),
  source       text not null,                 -- idx | fub | photos | pipeline | directory | marketing
  status       text not null default 'running', -- running | ok | error
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  records      integer not null default 0,
  error        text,
  meta         jsonb not null default '{}'::jsonb
);
create index on sync_runs (source, started_at desc);

-- ── generic server-side cache (command center, FUB schema, etc.) ──────────
create table external_cache (
  key         text primary key,
  payload     jsonb not null,
  expires_at  timestamptz,
  updated_at  timestamptz not null default now()
);
