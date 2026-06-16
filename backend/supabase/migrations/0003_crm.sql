-- ════════════════════════════════════════════════════════════════════════
-- 0003_crm.sql — leads, contacts, deals, deal workflow, tasks, notes, appts
-- ════════════════════════════════════════════════════════════════════════

-- ── leads: buyer/seller onboarding submissions (system of record) ─────────
create table leads (
  id              uuid primary key default gen_random_uuid(),
  form_type       text not null,            -- buyer-onboarding | seller-onboarding
  page            text,
  submitted_at    timestamptz,
  render_ms       integer,
  name            text,
  email           text,
  phone           text,
  contact_methods text[] not null default '{}',
  how_heard       text,
  marketing       jsonb not null default '{}'::jsonb,
  agent_id        uuid references agents(id) on delete set null,
  agent_name      text,
  agent_email     text,
  match_me        boolean not null default false,
  payload         jsonb not null default '{}'::jsonb,   -- full questionnaire
  fub_person_id   text,
  fub_note_id     text,
  fub_synced      boolean not null default false,
  status          text not null default 'new',          -- new | synced | error
  error           text,
  ip              text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on leads (form_type, created_at desc);
create index on leads (lower(email));
create index on leads (fub_person_id);
create trigger leads_updated before update on leads
  for each row execute function set_updated_at();

-- ── contacts: mirror of FUB people ────────────────────────────────────────
create table contacts (
  id                  uuid primary key default gen_random_uuid(),
  fub_person_id       text unique,
  name                text,
  email               text,
  phone               text,
  tags                text[] not null default '{}',
  stage               text,
  source              text,
  assigned_agent_id   uuid references agents(id) on delete set null,
  assigned_user_id    text,
  assigned_name       text,
  last_activity_at    timestamptz,
  created_at_fub      timestamptz,
  person_url          text,
  raw                 jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on contacts (assigned_agent_id);
create index on contacts (lower(email));
create trigger contacts_updated before update on contacts
  for each row execute function set_updated_at();

-- ── deals: mirror of FUB deals ────────────────────────────────────────────
create table deals (
  id              uuid primary key default gen_random_uuid(),
  fub_deal_id     text unique,
  contact_id      uuid references contacts(id) on delete set null,
  fub_person_id   text,
  title           text,
  address         text,
  client          text,
  side            text,                  -- buy | sell | cash
  price           numeric,
  stage           text,
  pipeline_id     text,
  status          text,                  -- open | won | lost | archived | unknown
  close_date      date,
  agent_name      text,
  agent_id        uuid references agents(id) on delete set null,
  lender          jsonb not null default '{}'::jsonb,
  attorney        jsonb not null default '{}'::jsonb,
  dates           jsonb not null default '{}'::jsonb,
  deal_url        text,
  person_url      text,
  tags            text[] not null default '{}',
  raw             jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on deals (status);
create index on deals (contact_id);
create index on deals (agent_id);
create trigger deals_updated before update on deals
  for each row execute function set_updated_at();

-- ── deal_workflow: ASG-specific workflow fields (Deal Tracker sheet) ──────
-- Keyed by raw FUB deal id; merged with FUB deal data in the dealTracker view.
create table deal_workflow (
  fub_deal_id              text primary key,
  lender_name              text,
  lender_company           text,
  attorney_name            text,
  attorney_company         text,
  earnest                  jsonb not null default '{}'::jsonb,   -- {initial:{amount,sent,...}, balance:{...}}
  extended                 jsonb not null default '{}'::jsonb,   -- {attorney, mortgageCommitment}
  checklist                jsonb not null default '{}'::jsonb,   -- 11 closing flags
  date_overrides           jsonb not null default '{}'::jsonb,   -- {inspection, attorney, appraisal, mortgageCommitment}
  raw                      jsonb not null default '{}'::jsonb,
  updated_at               timestamptz not null default now()
);
create trigger deal_workflow_updated before update on deal_workflow
  for each row execute function set_updated_at();

-- ── tasks: FUB tasks (admin tasks surface in agent hub) ───────────────────
create table tasks (
  id                uuid primary key default gen_random_uuid(),
  fub_task_id       text unique,
  contact_id        uuid references contacts(id) on delete cascade,
  fub_person_id     text,
  deal_id           uuid references deals(id) on delete set null,
  title             text,
  completed         boolean not null default false,
  due_date          date,
  assigned_user_id  text,
  is_admin          boolean not null default false,
  raw               jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on tasks (contact_id);
create index on tasks (completed);
create trigger tasks_updated before update on tasks
  for each row execute function set_updated_at();

-- ── notes: FUB notes ──────────────────────────────────────────────────────
create table notes (
  id              uuid primary key default gen_random_uuid(),
  fub_note_id     text unique,
  contact_id      uuid references contacts(id) on delete cascade,
  fub_person_id   text,
  deal_id         uuid references deals(id) on delete set null,
  body            text,
  author          text,
  created_at_fub  timestamptz,
  raw             jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index on notes (contact_id);
create index on notes (deal_id);

-- ── appointments: FUB appointments ────────────────────────────────────────
create table appointments (
  id              uuid primary key default gen_random_uuid(),
  fub_appt_id     text unique,
  contact_id      uuid references contacts(id) on delete cascade,
  fub_person_id   text,
  deal_id         uuid references deals(id) on delete set null,
  title           text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  status          text,
  raw             jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index on appointments (contact_id);
create index on appointments (deal_id);
