-- ════════════════════════════════════════════════════════════════════════
-- 0017_listing_marketing_agent.sql — AI marketing-draft jobs + drafts (+ brand)
-- A seller onboarding queues a best-effort job; a worker drafts an on-brand,
-- Fair-Housing-compliant marketing package for HUMAN review. Drafts only —
-- nothing here ever auto-publishes to the site, FUB, or MLS.
-- ════════════════════════════════════════════════════════════════════════

create type listing_marketing_job_status as enum
  ('queued', 'claimed', 'running', 'succeeded', 'failed', 'skipped');
create type listing_marketing_draft_status as enum
  ('draft', 'approved', 'rejected');

-- ── listing_marketing_jobs: queue + retry + idempotency + cost audit ──────
-- Follows the sync_runs bookkeeping style. input_hash makes enqueue idempotent
-- so a re-submitted questionnaire with unchanged answers never triggers a paid
-- run; a changed questionnaire produces a new hash → a new job → a new version.
create table listing_marketing_jobs (
  id                 uuid primary key default gen_random_uuid(),
  listing_id         uuid not null references listings(id) on delete cascade,
  status             listing_marketing_job_status not null default 'queued',
  input_hash         text not null,                  -- questionnaire + MLS facts
  attempts           integer not null default 0,
  max_attempts       integer not null default 3,
  run_after          timestamptz not null default now(),  -- backoff (M5)
  claimed_at         timestamptz,
  started_at         timestamptz,
  finished_at        timestamptz,
  error              text,
  model              text,
  input_tokens       integer not null default 0,
  output_tokens      integer not null default 0,
  total_tokens       integer not null default 0,
  estimated_cost_usd numeric not null default 0,
  meta               jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
-- Idempotency: one job per (listing, input). Re-enqueue is `on conflict do nothing`.
create unique index listing_marketing_jobs_listing_hash_uidx
  on listing_marketing_jobs (listing_id, input_hash);
create index listing_marketing_jobs_status_idx on listing_marketing_jobs (status, run_after);
create index listing_marketing_jobs_listing_idx on listing_marketing_jobs (listing_id);
create trigger listing_marketing_jobs_updated before update on listing_marketing_jobs
  for each row execute function set_updated_at();

-- ── listing_marketing_drafts: the reviewable, on-brand package ────────────
create table listing_marketing_drafts (
  id                 uuid primary key default gen_random_uuid(),
  listing_id         uuid not null references listings(id) on delete cascade,
  job_id             uuid references listing_marketing_jobs(id) on delete set null,
  version            integer not null,
  status             listing_marketing_draft_status not null default 'draft',
  content_pillar     text,                          -- Market Insight | Educational | Neighborhood | Lifestyle
  mls_description    text,
  social_captions    jsonb not null default '[]'::jsonb,   -- 3 captions
  email_blast        text,
  fact_sheet         jsonb not null default '{}'::jsonb,
  assets             jsonb not null default '{}'::jsonb,    -- catch-all / future assets
  compliance         jsonb not null default '{}'::jsonb,    -- {passed, violations[], fixes[], brandVoice}
  compliance_passed  boolean not null default false,
  model              text,
  reviewed_by        text,
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index listing_marketing_drafts_version_uidx
  on listing_marketing_drafts (listing_id, version);
create index listing_marketing_drafts_listing_idx on listing_marketing_drafts (listing_id, created_at desc);
create index listing_marketing_drafts_status_idx on listing_marketing_drafts (status);
create trigger listing_marketing_drafts_updated before update on listing_marketing_drafts
  for each row execute function set_updated_at();

-- ── brand_guidelines: ASG brand voice, editable without a deploy ──────────
-- NOT seeded here — awaiting the real ASG brand guide. We do not fabricate
-- brand rules; M2 reads the active row keyed 'asg'.
create table brand_guidelines (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique default 'asg',
  voice          text,            -- tone / voice rules
  do_rules       jsonb not null default '[]'::jsonb,
  dont_rules     jsonb not null default '[]'::jsonb,
  banned_phrases jsonb not null default '[]'::jsonb,   -- Fair Housing rule-based seed
  raw            jsonb not null default '{}'::jsonb,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger brand_guidelines_updated before update on brand_guidelines
  for each row execute function set_updated_at();
