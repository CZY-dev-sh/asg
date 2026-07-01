-- ════════════════════════════════════════════════════════════════════════
-- 0019_fub_webhooks.sql — FUB webhook event log
--   Per Follow Up Boss's own best-practice guide: decouple *receiving* a
--   webhook POST from *processing* it. The route just verifies the request
--   and writes a row here, then acks 2XX immediately (FUB requires a
--   response within 10s and retries hard on non-2XX). A separate step
--   (fired right after the ack, plus a cron safety net) fetches the changed
--   record from FUB and upserts it — this table is the source of truth for
--   what's been received/processed, so a crash mid-processing never loses
--   an event silently.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists fub_webhook_events (
  id            bigint generated always as identity primary key,
  event_id      text not null unique,               -- FUB's own eventId (idempotency key)
  event         text not null,                       -- e.g. dealsUpdated, peopleCreated
  resource_ids  text[] not null default '{}',
  uri           text,                                 -- GET this to fetch the changed record(s)
  payload       jsonb not null,                       -- raw webhook body, for replay/debugging
  status        text not null default 'pending',      -- pending | processed | error
  attempts      integer not null default 0,
  error         text,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz
);
create index if not exists fub_webhook_events_status_idx on fub_webhook_events (status, id);
create index if not exists fub_webhook_events_event_idx on fub_webhook_events (event, received_at desc);
