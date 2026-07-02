/**
 * Mirror agent icon photos into Supabase Storage.
 *
 * Rule: every hub renders agent avatars from the directory's `icon_photo_url`.
 * Those URLs historically pointed at the Squarespace CDN; this tool downloads
 * each one, uploads it to the public `headshots` bucket (agents/{slug}-icon),
 * and repoints `agents.icon_photo_url` at the Supabase URL. The original URL is
 * preserved in `agents.icon_photo_source` so re-runs are idempotent (rows
 * already pointing at Supabase Storage are skipped) and so the directory sheet
 * sync can tell a genuinely new photo from the one already mirrored.
 *
 * Run:  npm run photos:mirror-agents
 */
import { sql, closeDb } from '../db/client.js';
import { env } from '../env.js';
import { uploadObject } from '../storage.js';
import { log } from '../logger.js';

type Row = Record<string, unknown>;

const extFor = (contentType: string, url: string): string => {
  if (/png/i.test(contentType)) return 'png';
  if (/webp/i.test(contentType)) return 'webp';
  if (/jpe?g/i.test(contentType)) return 'jpg';
  const m = /\.(jpe?g|png|webp)(\?|$)/i.exec(url);
  return m?.[1]?.replace('jpeg', 'jpg') ?? 'jpg';
};

async function main() {
  const supabaseHost = new URL(env.SUPABASE_URL).host;
  const rows = await sql<Row[]>`
    select id, slug, name, icon_photo_url from agents
    where icon_photo_url is not null and active = true order by name`;

  let mirrored = 0;
  let skipped = 0;
  for (const r of rows) {
    const url = String(r.icon_photo_url);
    if (url.includes(supabaseHost)) { skipped++; continue; }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const contentType = res.headers.get('content-type') ?? 'image/jpeg';
      const buf = Buffer.from(await res.arrayBuffer());
      const path = `agents/${r.slug}-icon.${extFor(contentType, url)}`;
      const up = await uploadObject('headshots', path, buf, contentType);
      await sql`
        update agents set icon_photo_url = ${up.publicUrl},
          icon_photo_source = ${url},
          updated_at = now()
        where id = ${String(r.id)}::uuid`;
      mirrored++;
      log.info(`mirrored ${r.name} → ${up.publicUrl}`);
    } catch (err) {
      log.warn(`could not mirror ${r.name}: ${String(err)}`);
    }
  }
  log.info(`done: ${mirrored} mirrored, ${skipped} already on Supabase, ${rows.length} total`);
  await closeDb();
}

main().catch(async (err) => {
  log.error('mirrorAgentPhotos failed', err);
  await closeDb();
  process.exit(1);
});
