-- ════════════════════════════════════════════════════════════════════════
-- 0023_icon_photo_source.sql — keep mirrored agent icon photos stable
--   Rule: every hub renders agent avatars from agents.icon_photo_url, which is
--   mirrored into Supabase Storage (headshots/agents/*). The directory sheet
--   sync would otherwise overwrite that URL with the sheet's external one on
--   every push. icon_photo_source records which external URL a mirror came
--   from, so the sync can tell "same photo, keep the Supabase copy" apart from
--   "new photo, take it (and re-mirror)".
-- ════════════════════════════════════════════════════════════════════════

alter table agents add column if not exists icon_photo_source text;

-- Backfill from the mirror tool's earlier raw-jsonb stash, if present.
update agents set icon_photo_source = raw->>'icon_photo_source'
  where icon_photo_source is null and raw ? 'icon_photo_source';
