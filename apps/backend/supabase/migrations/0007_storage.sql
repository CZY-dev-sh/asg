-- ════════════════════════════════════════════════════════════════════════
-- 0007_storage.sql — Supabase Storage buckets for photos & assets
-- ════════════════════════════════════════════════════════════════════════
-- Buckets are public-read so the website can render mirrored photos directly
-- from the Supabase CDN. Writes happen only via the service-role key (server).
-- Guarded so the migration is a no-op on a plain Postgres without the storage
-- schema (the backend can also create buckets at runtime via ensureBucket()).

do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'storage schema not found — skipping bucket setup (not a Supabase database)';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    ('listing-photos', 'listing-photos', true, 26214400,
       array['image/jpeg','image/png','image/webp','image/avif','image/gif']),
    ('headshots', 'headshots', true, 10485760,
       array['image/jpeg','image/png','image/webp']),
    ('brand-assets', 'brand-assets', true, 52428800, null)
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'asg_public_read'
  ) then
    create policy asg_public_read on storage.objects
      for select to public
      using (bucket_id in ('listing-photos', 'headshots', 'brand-assets'));
  end if;
end $$;
