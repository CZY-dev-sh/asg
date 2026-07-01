-- ════════════════════════════════════════════════════════════════════════
-- 0018_marketing_tasks.sql — general (non-listing) marketing work
--   • marketing_tasks: per-agent marketing requests not tied to a listing
--     (flyers, social posts, CMAs, ad-hoc design). Supabase is the system of
--     record; Asana mirroring is best-effort and optional.
--   • v_marketing_work: a union of marketing_tasks + listing_requests in one
--     shape, so the workload board and "my tasks" read from a single place.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists marketing_tasks (
  id               uuid primary key default gen_random_uuid(),
  agent_id         uuid not null references agents(id) on delete cascade,
  listing_id       uuid references listings(id) on delete set null,
  title            text not null,
  category         text not null default 'general',  -- social_post | flyer | cma | general | custom
  status           text not null default 'requested', -- requested | in_progress | done | cancelled
  assignee         text,                              -- tim | ellie | other (free text)
  notes            text,
  materials        jsonb not null default '[]'::jsonb,
  requested_by     text,
  requested_at     timestamptz not null default now(),
  due_on           date,
  completed_at     timestamptz,
  source           text not null default 'admin',     -- agent_portal | admin | onboarding
  asana_task_gid   text,
  asana_task_url   text,
  asana_project_gid text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists marketing_tasks_agent_idx on marketing_tasks (agent_id, status);
create index if not exists marketing_tasks_listing_idx on marketing_tasks (listing_id);
create trigger marketing_tasks_updated before update on marketing_tasks
  for each row execute function set_updated_at();

-- ── Unified read model: general tasks + listing requests in one shape ─────
-- Listing-request statuses are normalized so workload counts line up
-- ('delivered' → 'done'); the agent is the listing's primary agent.
create or replace view v_marketing_work as
select
  'general'::text          as source,
  mt.id,
  mt.agent_id,
  mt.listing_id,
  mt.title,
  mt.category              as kind,
  mt.status,
  mt.assignee,
  mt.due_on,
  mt.requested_at,
  mt.completed_at,
  mt.asana_task_url
from marketing_tasks mt
union all
select
  'listing'::text          as source,
  lr.id,
  l.agent_id,
  lr.listing_id,
  lr.kind                  as title,
  lr.kind,
  case when lr.status = 'delivered' then 'done' else lr.status end as status,
  null::text               as assignee,
  null::date               as due_on,
  lr.requested_at,
  lr.delivered_at          as completed_at,
  lr.asana_task_url
from listing_requests lr
join listings l on l.id = lr.listing_id;

-- ── RLS (defense-in-depth; the API uses the service-role connection) ──────
do $migration$
begin
  if not exists (select 1 from pg_proc where proname = 'is_admin') then
    raise notice 'is_admin() not found — skipping marketing_tasks policies (run 0009 first)';
    return;
  end if;

  execute $sql$ alter table marketing_tasks enable row level security $sql$;

  if not exists (select 1 from pg_policies where tablename = 'marketing_tasks' and policyname = 'marketing_tasks_admin_write') then
    execute $sql$ create policy marketing_tasks_admin_write on marketing_tasks for all
                  using (is_admin()) with check (is_admin()) $sql$;
  end if;
  if not exists (select 1 from pg_policies where tablename = 'marketing_tasks' and policyname = 'marketing_tasks_agent_read') then
    execute $sql$ create policy marketing_tasks_agent_read on marketing_tasks for select
                  using (agent_id = current_agent_id()) $sql$;
  end if;
  if not exists (select 1 from pg_policies where tablename = 'marketing_tasks' and policyname = 'marketing_tasks_agent_insert') then
    execute $sql$ create policy marketing_tasks_agent_insert on marketing_tasks for insert
                  with check (agent_id = current_agent_id()) $sql$;
  end if;
end
$migration$;
