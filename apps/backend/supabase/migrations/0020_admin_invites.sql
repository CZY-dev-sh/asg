-- ════════════════════════════════════════════════════════════════════════
-- 0020_admin_invites.sql — admin onboarding: invite-by-email
--   Today the only way to make someone an admin is a manual SQL update.
--   This adds an explicit invite record so a new admin's role is granted
--   by that record (not inferred from domain/roster the way role=agent is),
--   and extends handle_new_user() (from 0009_accounts.sql) to honor it —
--   a matching pending invite wins over the usual compass.com→agent gate.
-- ════════════════════════════════════════════════════════════════════════

do $migration$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'auth') then
    raise notice 'auth schema not found — skipping admin_invites (run on Supabase)';
    return;
  end if;

  execute $sql$
    create table if not exists admin_invites (
      id          uuid primary key default gen_random_uuid(),
      email       text not null unique,
      full_name   text,
      invited_by  uuid references profiles(id) on delete set null,
      status      text not null default 'pending', -- pending | claimed | revoked
      created_at  timestamptz not null default now(),
      claimed_at  timestamptz,
      expires_at  timestamptz not null default now() + interval '14 days'
    )
  $sql$;
  execute $sql$ create index if not exists admin_invites_status_idx on admin_invites (status, email) $sql$;

  execute $sql$ alter table admin_invites enable row level security $sql$;
  if not exists (select 1 from pg_policies where tablename = 'admin_invites' and policyname = 'admin_invites_admin_all') then
    execute $sql$ create policy admin_invites_admin_all on admin_invites for all
                  using (is_admin()) with check (is_admin()) $sql$;
  end if;

  -- Re-declare handle_new_user() with an admin-invite branch checked first.
  -- Everything below the invite check is unchanged from 0009_accounts.sql.
  execute $sql$
    create or replace function handle_new_user() returns trigger
    language plpgsql security definer set search_path = public, auth as $fn$
    declare
      v_domain text := lower(split_part(coalesce(new.email, ''), '@', 2));
      v_agent  agents%rowtype;
      v_invite admin_invites%rowtype;
    begin
      select * into v_invite from admin_invites
        where lower(email) = lower(new.email) and status = 'pending' and expires_at > now()
        order by created_at desc limit 1;
      if found then
        insert into profiles (id, email, full_name, role)
        values (
          new.id, lower(new.email),
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', v_invite.full_name, ''),
          'admin'
        )
        on conflict (id) do update set role = 'admin';
        update admin_invites set status = 'claimed', claimed_at = now() where id = v_invite.id;
        return new;
      end if;

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
end
$migration$;
