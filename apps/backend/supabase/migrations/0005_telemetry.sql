-- ════════════════════════════════════════════════════════════════════════
-- 0005_telemetry.sql — usage events + QA log (replaces Usage Log sheet)
-- ════════════════════════════════════════════════════════════════════════

create table usage_events (
  id           bigint generated always as identity primary key,
  ts           timestamptz not null default now(),
  type         text,                 -- view | click | custom
  page         text,
  label        text,
  url          text,
  visitor_id   text,
  agent_email  text,
  agent_name   text,
  session_id   text,
  user_agent   text,
  referrer     text,
  meta         jsonb not null default '{}'::jsonb
);
create index on usage_events (ts desc);
create index on usage_events (page);
create index on usage_events (lower(agent_email));
create index on usage_events (type);

create table qa_log (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  kind        text,                  -- broken_link | apps_script_error | stale_dashboard | ...
  title       text,
  severity    text,                  -- red | amber | green
  status      text                   -- open | resolved
);
create index on qa_log (ts desc);
