-- ════════════════════════════════════════════════════════════════════════
-- 0021_admin_allowlist.sql — lock the admin role to a named allowlist
--   The Admin Hub is for ASG leadership/ops only. Until now any @compass.com
--   roster email became an `agent`, and there was no deterministic way to be
--   an `admin` (0020 added invites, but no permanent list). This adds an
--   explicit `admin_allowlist` table, seeds the five people who run the hub,
--   and rewrites handle_new_user() so the allowlist wins over the usual
--   compass.com→agent gate (invites from 0020 still work too).
--
--   Everyone else on compass.com stays an `agent` (they'll use the Agent Hub).
-- ════════════════════════════════════════════════════════════════════════

do $migration$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'auth') then
    raise notice 'auth schema not found — skipping admin_allowlist (run on Supabase)';
    return;
  end if;

  execute $sql$
    create table if not exists admin_allowlist (
      email      text primary key,
      note       text,
      created_at timestamptz not null default now()
    )
  $sql$;

  -- Seed the five hub admins (idempotent).
  execute $sql$
    insert into admin_allowlist (email, note) values
      ('alex.stoykov@compass.com', 'Owner'),
      ('ellyn.andree@compass.com', 'Sales Director'),
      ('ellie.ngassa@compass.com', 'Marketing Coordinator'),
      ('tim.urmanczy@compass.com', 'Marketing Director'),
      ('seph.gagon@compass.com',   'Transaction Coordinator')
    on conflict (email) do nothing
  $sql$;

  execute $sql$ alter table admin_allowlist enable row level security $sql$;
  if not exists (select 1 from pg_policies where tablename = 'admin_allowlist' and policyname = 'admin_allowlist_admin_all') then
    execute $sql$ create policy admin_allowlist_admin_all on admin_allowlist for all
                  using (is_admin()) with check (is_admin()) $sql$;
  end if;

  -- Rewrite the signup handler: allowlist → admin, then pending invite → admin,
  -- then compass roster → agent, else client.
  execute $sql$
    create or replace function handle_new_user() returns trigger
    language plpgsql security definer set search_path = public, auth as $fn$
    declare
      v_email  text := lower(coalesce(new.email, ''));
      v_domain text := split_part(v_email, '@', 2);
      v_agent  agents%rowtype;
      v_invite admin_invites%rowtype;
    begin
      -- 1) Permanent admin allowlist (leadership/ops who run the Admin Hub).
      if exists (select 1 from admin_allowlist where email = v_email) then
        select * into v_agent from agents where lower(email) = v_email limit 1;
        insert into profiles (id, email, full_name, role, agent_id)
        values (new.id, v_email,
                coalesce(v_agent.name, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
                'admin', v_agent.id)
        on conflict (id) do update set role = 'admin', agent_id = coalesce(excluded.agent_id, profiles.agent_id);
        return new;
      end if;

      -- 2) Pending admin invite (0020) — an admin explicitly invited this person.
      select * into v_invite from admin_invites
        where lower(email) = v_email and status = 'pending' and expires_at > now()
        order by created_at desc limit 1;
      if found then
        insert into profiles (id, email, full_name, role)
        values (new.id, v_email,
                coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', v_invite.full_name, ''),
                'admin')
        on conflict (id) do update set role = 'admin';
        update admin_invites set status = 'claimed', claimed_at = now() where id = v_invite.id;
        return new;
      end if;

      -- 3) Compass roster → agent (Agent Hub).
      if v_domain = 'compass.com' then
        select * into v_agent from agents where lower(email) = v_email limit 1;
        if not found then
          raise exception 'This Compass email is not on the ASG roster. Ask an admin to add you.'
            using errcode = 'check_violation';
        end if;
        insert into profiles (id, email, full_name, role, agent_id)
        values (new.id, v_email, v_agent.name, 'agent', v_agent.id)
        on conflict (id) do update set role = 'agent', agent_id = excluded.agent_id;
      -- 4) Everyone else → client.
      else
        insert into profiles (id, email, full_name, role, contact_id)
        values (new.id, v_email,
                coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
                'client',
                (select id from contacts where lower(email) = v_email limit 1))
        on conflict (id) do nothing;
      end if;
      return new;
    end;
    $fn$
  $sql$;

  -- ── Backfill existing profiles to match the new rules ──
  -- The profiles guard trigger (0009) reverts role changes unless the *session*
  -- is an admin; a migration connection has no auth.uid(), so temporarily run in
  -- replica mode to let these one-time role corrections through.
  execute $sql$ set local session_replication_role = replica $sql$;

  -- Promote allowlisted people who already have a profile.
  execute $sql$
    update profiles p set role = 'admin',
      agent_id = coalesce(p.agent_id, (select a.id from agents a where lower(a.email) = p.email limit 1))
    where p.email in (select email from admin_allowlist) and p.role <> 'admin'
  $sql$;

  -- Demote any current admin who is NOT on the allowlist and NOT a claimed invite.
  -- Compass roster members become agents; anyone else becomes a client.
  execute $sql$
    update profiles p set role = case when split_part(p.email,'@',2) = 'compass.com' then 'agent'::user_role else 'client'::user_role end
    where p.role = 'admin'
      and p.email not in (select email from admin_allowlist)
      and not exists (select 1 from admin_invites ai where lower(ai.email) = p.email and ai.status = 'claimed')
  $sql$;

  execute $sql$ set local session_replication_role = origin $sql$;
end
$migration$;
