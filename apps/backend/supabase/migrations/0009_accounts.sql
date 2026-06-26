-- ════════════════════════════════════════════════════════════════════════
-- 0009_accounts.sql — user accounts (Supabase Auth) + client portal + RLS
-- ════════════════════════════════════════════════════════════════════════
-- Adds role-based accounts on top of Supabase Auth (auth.users), all in the
-- same database:
--   • profiles            — one per auth user, role = client | agent | admin
--   • onboarding_drafts   — saved buyer/seller onboarding progress per user
--   • RLS policies        — clients see only their own deals/leads; agents see
--                           their assigned book; admins see everything
--   • handle_new_user()   — gates @compass.com signups to the ASG roster
--                           (agents log in only with their roster email),
--                           everyone else becomes a client.
--
-- Wrapped in a guard so the migration is a safe no-op on a plain Postgres that
-- has no `auth` schema (i.e. not a Supabase database).

do $migration$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'auth') then
    raise notice 'auth schema not found — skipping accounts/RLS setup (run on Supabase)';
    return;
  end if;

  ----------------------------------------------------------------------------
  -- enums
  ----------------------------------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'user_role') then
    execute $sql$ create type user_role as enum ('client', 'agent', 'admin') $sql$;
  end if;

  ----------------------------------------------------------------------------
  -- profiles (1:1 with auth.users)
  ----------------------------------------------------------------------------
  execute $sql$
    create table if not exists profiles (
      id          uuid primary key references auth.users(id) on delete cascade,
      email       text unique,
      full_name   text,
      phone       text,
      role        user_role not null default 'client',
      agent_id    uuid references agents(id) on delete set null,
      contact_id  uuid references contacts(id) on delete set null,
      created_at  timestamptz not null default now(),
      updated_at  timestamptz not null default now()
    )
  $sql$;
  execute $sql$ create index if not exists profiles_role_idx on profiles (role) $sql$;
  execute $sql$ create index if not exists profiles_agent_idx on profiles (agent_id) $sql$;
  execute $sql$ create index if not exists profiles_contact_idx on profiles (contact_id) $sql$;
  begin
    execute $sql$ create trigger profiles_updated before update on profiles
                  for each row execute function set_updated_at() $sql$;
  exception when duplicate_object then null; end;

  ----------------------------------------------------------------------------
  -- onboarding drafts (resume a buyer/seller wizard later)
  ----------------------------------------------------------------------------
  execute $sql$
    create table if not exists onboarding_drafts (
      id          uuid primary key default gen_random_uuid(),
      user_id     uuid not null references auth.users(id) on delete cascade,
      form_type   text not null,            -- buyer-onboarding | seller-onboarding
      step        integer not null default 0,
      data        jsonb not null default '{}'::jsonb,
      completed   boolean not null default false,
      lead_id     uuid references leads(id) on delete set null,
      created_at  timestamptz not null default now(),
      updated_at  timestamptz not null default now(),
      unique (user_id, form_type)
    )
  $sql$;
  begin
    execute $sql$ create trigger onboarding_drafts_updated before update on onboarding_drafts
                  for each row execute function set_updated_at() $sql$;
  exception when duplicate_object then null; end;

  -- let clients optionally claim their lead/contact after creating an account
  execute $sql$ alter table leads add column if not exists user_id uuid references auth.users(id) on delete set null $sql$;

  ----------------------------------------------------------------------------
  -- helper functions (SECURITY DEFINER → owned by postgres → bypass RLS on
  -- profiles, so policies that call them don't recurse)
  ----------------------------------------------------------------------------
  execute $sql$
    create or replace function current_role_name() returns user_role
    language sql stable security definer set search_path = public, auth as $fn$
      select role from profiles where id = auth.uid()
    $fn$
  $sql$;
  execute $sql$
    create or replace function is_admin() returns boolean
    language sql stable security definer set search_path = public, auth as $fn$
      select coalesce((select role = 'admin' from profiles where id = auth.uid()), false)
    $fn$
  $sql$;
  execute $sql$
    create or replace function current_contact_id() returns uuid
    language sql stable security definer set search_path = public, auth as $fn$
      select contact_id from profiles where id = auth.uid()
    $fn$
  $sql$;
  execute $sql$
    create or replace function current_agent_id() returns uuid
    language sql stable security definer set search_path = public, auth as $fn$
      select agent_id from profiles where id = auth.uid()
    $fn$
  $sql$;

  ----------------------------------------------------------------------------
  -- new-user handler: gate compass.com → roster agents, everyone else client
  ----------------------------------------------------------------------------
  execute $sql$
    create or replace function handle_new_user() returns trigger
    language plpgsql security definer set search_path = public, auth as $fn$
    declare
      v_domain text := lower(split_part(coalesce(new.email, ''), '@', 2));
      v_agent  agents%rowtype;
    begin
      if v_domain = 'compass.com' then
        select * into v_agent from agents where lower(email) = lower(new.email) limit 1;
        if not found then
          raise exception 'This Compass email is not on the ASG roster. Ask an admin to add you.'
            using errcode = 'check_violation';
        end if;
        insert into profiles (id, email, full_name, role, agent_id)
        values (new.id, lower(new.email), v_agent.name, 'agent', v_agent.id)
        on conflict (id) do update set role = 'agent', agent_id = excluded.agent_id;
      else
        insert into profiles (id, email, full_name, role, contact_id)
        values (
          new.id, lower(new.email),
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
          'client',
          (select id from contacts where lower(email) = lower(new.email) limit 1)
        )
        on conflict (id) do nothing;
      end if;
      return new;
    end;
    $fn$
  $sql$;
  begin
    execute $sql$ drop trigger if exists on_auth_user_created on auth.users $sql$;
    execute $sql$ create trigger on_auth_user_created after insert on auth.users
                  for each row execute function handle_new_user() $sql$;
  exception when insufficient_privilege then
    raise notice 'could not attach trigger to auth.users — create it via Supabase dashboard';
  end;

  ----------------------------------------------------------------------------
  -- prevent clients from escalating their own role/links
  ----------------------------------------------------------------------------
  execute $sql$
    create or replace function guard_profile_update() returns trigger
    language plpgsql security definer set search_path = public, auth as $fn$
    begin
      if is_admin() then return new; end if;
      new.role := old.role;
      new.agent_id := old.agent_id;
      new.contact_id := old.contact_id;
      return new;
    end;
    $fn$
  $sql$;
  begin
    execute $sql$ create trigger profiles_guard before update on profiles
                  for each row execute function guard_profile_update() $sql$;
  exception when duplicate_object then null; end;

  ----------------------------------------------------------------------------
  -- Row Level Security
  ----------------------------------------------------------------------------
  execute $sql$ alter table profiles enable row level security $sql$;
  execute $sql$ alter table onboarding_drafts enable row level security $sql$;
  execute $sql$ alter table deals enable row level security $sql$;
  execute $sql$ alter table deal_workflow enable row level security $sql$;
  execute $sql$ alter table contacts enable row level security $sql$;
  execute $sql$ alter table leads enable row level security $sql$;
  execute $sql$ alter table appointments enable row level security $sql$;
  execute $sql$ alter table tasks enable row level security $sql$;
  execute $sql$ alter table notes enable row level security $sql$;

  -- profiles: read/update own; admins read all
  execute $sql$ create policy profiles_self_select on profiles for select using (id = auth.uid() or is_admin()) $sql$;
  execute $sql$ create policy profiles_self_update on profiles for update using (id = auth.uid() or is_admin()) $sql$;

  -- onboarding drafts: owner only
  execute $sql$ create policy drafts_owner_all on onboarding_drafts for all
                using (user_id = auth.uid()) with check (user_id = auth.uid()) $sql$;

  -- contacts: client sees own; agent sees assigned; admin all
  execute $sql$ create policy contacts_scoped_select on contacts for select using (
    is_admin() or id = current_contact_id() or assigned_agent_id = current_agent_id()
  ) $sql$;

  -- deals: client sees own deals; agent sees assigned; admin all
  execute $sql$ create policy deals_scoped_select on deals for select using (
    is_admin() or contact_id = current_contact_id() or agent_id = current_agent_id()
  ) $sql$;

  -- deal_workflow: visible when the parent deal is visible
  execute $sql$ create policy deal_workflow_scoped_select on deal_workflow for select using (
    is_admin() or exists (
      select 1 from deals d where d.fub_deal_id = deal_workflow.fub_deal_id
        and (d.contact_id = current_contact_id() or d.agent_id = current_agent_id())
    )
  ) $sql$;

  -- appointments: clients (their showings/inspections) + agents + admin
  execute $sql$ create policy appts_scoped_select on appointments for select using (
    is_admin() or contact_id = current_contact_id()
      or exists (select 1 from contacts c where c.id = appointments.contact_id and c.assigned_agent_id = current_agent_id())
  ) $sql$;

  -- tasks / notes: internal — agents + admin only (clients excluded)
  execute $sql$ create policy tasks_internal_select on tasks for select using (
    is_admin() or exists (select 1 from contacts c where c.id = tasks.contact_id and c.assigned_agent_id = current_agent_id())
  ) $sql$;
  execute $sql$ create policy notes_internal_select on notes for select using (
    is_admin() or exists (select 1 from contacts c where c.id = notes.contact_id and c.assigned_agent_id = current_agent_id())
  ) $sql$;

  -- leads: client sees leads tied to them (by user or email); agent sees assigned; admin all
  execute $sql$ create policy leads_scoped_select on leads for select using (
    is_admin()
    or user_id = auth.uid()
    or lower(email) = (select lower(email) from profiles where id = auth.uid())
    or agent_id = current_agent_id()
  ) $sql$;

end
$migration$;
