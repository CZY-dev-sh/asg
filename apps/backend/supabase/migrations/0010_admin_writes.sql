-- ════════════════════════════════════════════════════════════════════════
-- 0010_admin_writes.sql — write RLS policies for admin/staff dashboards
-- ════════════════════════════════════════════════════════════════════════
-- The Node API writes with the service-role connection (which bypasses RLS),
-- and authorizes each request at the API layer (requireWrite). These policies
-- are defense-in-depth for the day a dashboard talks to supabase-js directly
-- with a logged-in admin/agent session.
--
--   • admins (is_admin())            → full write on workflow/content tables
--   • agents (current_agent_id())    → write their own listings + assigned deals
--
-- Guarded so it's a safe no-op on a plain Postgres without the auth helpers
-- created in 0009.

do $migration$
begin
  if not exists (select 1 from pg_proc where proname = 'is_admin') then
    raise notice 'is_admin() not found — skipping admin write policies (run 0009 on Supabase first)';
    return;
  end if;

  -- Enable RLS on the content tables (idempotent).
  execute $sql$ alter table listings        enable row level security $sql$;
  execute $sql$ alter table listing_photos  enable row level security $sql$;
  execute $sql$ alter table agents          enable row level security $sql$;
  execute $sql$ alter table team_events     enable row level security $sql$;
  execute $sql$ alter table team_updates    enable row level security $sql$;
  execute $sql$ alter table landing_pages   enable row level security $sql$;
  execute $sql$ alter table open_houses     enable row level security $sql$;

  -- Helper to create a policy only if it's missing (re-run safe).
  -- listings: admins everything, agents only their own rows.
  if not exists (select 1 from pg_policies where tablename = 'listings' and policyname = 'listings_admin_write') then
    execute $sql$ create policy listings_admin_write on listings for all
                  using (is_admin()) with check (is_admin()) $sql$;
  end if;
  if not exists (select 1 from pg_policies where tablename = 'listings' and policyname = 'listings_agent_write') then
    execute $sql$ create policy listings_agent_write on listings for all
                  using (agent_id = current_agent_id()) with check (agent_id = current_agent_id()) $sql$;
  end if;

  -- listing_photos: admins everything, agents for photos on their listings.
  if not exists (select 1 from pg_policies where tablename = 'listing_photos' and policyname = 'listing_photos_admin_write') then
    execute $sql$ create policy listing_photos_admin_write on listing_photos for all
                  using (is_admin()) with check (is_admin()) $sql$;
  end if;
  if not exists (select 1 from pg_policies where tablename = 'listing_photos' and policyname = 'listing_photos_agent_write') then
    execute $sql$ create policy listing_photos_agent_write on listing_photos for all
                  using (exists (select 1 from listings l where l.id = listing_photos.listing_id and l.agent_id = current_agent_id()))
                  with check (exists (select 1 from listings l where l.id = listing_photos.listing_id and l.agent_id = current_agent_id())) $sql$;
  end if;

  -- open_houses: admins only (agents read via listings join elsewhere).
  if not exists (select 1 from pg_policies where tablename = 'open_houses' and policyname = 'open_houses_admin_write') then
    execute $sql$ create policy open_houses_admin_write on open_houses for all
                  using (is_admin()) with check (is_admin()) $sql$;
  end if;

  -- agents directory: admins only.
  if not exists (select 1 from pg_policies where tablename = 'agents' and policyname = 'agents_admin_write') then
    execute $sql$ create policy agents_admin_write on agents for all
                  using (is_admin()) with check (is_admin()) $sql$;
  end if;

  -- team content: admins only.
  if not exists (select 1 from pg_policies where tablename = 'team_events' and policyname = 'team_events_admin_write') then
    execute $sql$ create policy team_events_admin_write on team_events for all
                  using (is_admin()) with check (is_admin()) $sql$;
  end if;
  if not exists (select 1 from pg_policies where tablename = 'team_updates' and policyname = 'team_updates_admin_write') then
    execute $sql$ create policy team_updates_admin_write on team_updates for all
                  using (is_admin()) with check (is_admin()) $sql$;
  end if;
  if not exists (select 1 from pg_policies where tablename = 'landing_pages' and policyname = 'landing_pages_admin_write') then
    execute $sql$ create policy landing_pages_admin_write on landing_pages for all
                  using (is_admin()) with check (is_admin()) $sql$;
  end if;

  -- deal_workflow already has a SELECT policy from 0009; add writes:
  if not exists (select 1 from pg_policies where tablename = 'deal_workflow' and policyname = 'deal_workflow_admin_write') then
    execute $sql$ create policy deal_workflow_admin_write on deal_workflow for all
                  using (is_admin()) with check (is_admin()) $sql$;
  end if;
  if not exists (select 1 from pg_policies where tablename = 'deal_workflow' and policyname = 'deal_workflow_agent_write') then
    execute $sql$ create policy deal_workflow_agent_write on deal_workflow for all
                  using (exists (select 1 from deals d where d.fub_deal_id = deal_workflow.fub_deal_id and d.agent_id = current_agent_id()))
                  with check (exists (select 1 from deals d where d.fub_deal_id = deal_workflow.fub_deal_id and d.agent_id = current_agent_id())) $sql$;
  end if;

  -- leads: admins manage all; agents update their assigned leads (triage/assign).
  if not exists (select 1 from pg_policies where tablename = 'leads' and policyname = 'leads_admin_write') then
    execute $sql$ create policy leads_admin_write on leads for all
                  using (is_admin()) with check (is_admin()) $sql$;
  end if;
  if not exists (select 1 from pg_policies where tablename = 'leads' and policyname = 'leads_agent_update') then
    execute $sql$ create policy leads_agent_update on leads for update
                  using (agent_id = current_agent_id()) with check (agent_id = current_agent_id()) $sql$;
  end if;

end
$migration$;
