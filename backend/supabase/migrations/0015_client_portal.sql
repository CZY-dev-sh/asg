-- ════════════════════════════════════════════════════════════════════════
-- 0015_client_portal.sql — client portal profile fields
-- ════════════════════════════════════════════════════════════════════════
-- Adds lightweight client-facing fields on profiles. The existing
-- guard_profile_update() trigger already prevents clients from changing role,
-- agent_id, or contact_id; these fields are intentionally user-editable.

do $migration$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
    raise notice 'profiles table not found — skipping client portal profile fields';
    return;
  end if;

  if not exists (select 1 from pg_type where typname = 'client_type') then
    create type client_type as enum ('buyer', 'seller', 'renter', 'undecided');
  end if;

  alter table profiles add column if not exists client_type client_type not null default 'undecided';
  alter table profiles add column if not exists portal_onboarding_completed boolean not null default false;
  alter table profiles add column if not exists portal_preferences jsonb not null default '{}'::jsonb;

  create index if not exists profiles_client_type_idx on profiles (client_type);

  create table if not exists listing_documents (
    id uuid primary key default gen_random_uuid(),
    listing_id uuid references listings(id) on delete cascade,
    title text not null,
    category text not null default 'document',
    file_url text,
    storage_path text,
    client_visible boolean not null default true,
    uploaded_by text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create index if not exists listing_documents_listing_idx on listing_documents (listing_id, created_at desc);
  create index if not exists listing_documents_client_idx on listing_documents (listing_id) where client_visible = true;
  begin
    create trigger listing_documents_updated before update on listing_documents
      for each row execute function set_updated_at();
  exception when duplicate_object then null; end;

  create table if not exists open_house_leads (
    id uuid primary key default gen_random_uuid(),
    listing_id uuid references listings(id) on delete cascade,
    open_house_id uuid references open_houses(id) on delete set null,
    name text,
    email text,
    phone text,
    source text not null default 'open_house_qr',
    fub_person_id text,
    notes text,
    raw jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  create index if not exists open_house_leads_listing_idx on open_house_leads (listing_id, created_at desc);
end
$migration$;
