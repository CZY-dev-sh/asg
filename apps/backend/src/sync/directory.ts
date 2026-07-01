import { sql, j } from '../db/client.js';
import { ROSTER, QUICK_LINKS } from '../data/roster.js';
import { slugify } from '../util/text.js';
import { fubClient } from '../connectors/fub.js';
import type { SyncResult } from './runner.js';

const tierRank: Record<string, number> = { senior: 1, junior: 2, admin: 3 };

/**
 * Seed the agents directory from the hardcoded roster, then enrich with FUB user
 * ids (so leads can be assigned and FUB data can be joined per agent).
 *
 * Source-of-truth decision: `POST /api/admin/directory` (the Google Sheet-backed
 * bulk upsert in `repositories/admin.ts`, which stamps `directory_synced_at` and
 * supports deactivation) is canonical once an agent has gone through it. This
 * roster is a *fallback seed only* — it exists so an agent can sign up and get a
 * minimal `agents` row before anyone's touched the sheet for them, and to survive
 * a from-scratch environment. The `where agents.directory_synced_at is null`
 * guard below means: once the sheet has synced an agent, this daily cron becomes
 * a no-op for them and will never again overwrite sheet-edited fields. Do not
 * remove that guard without re-reading `docs/AGENT-HUB-PRD.md` §4.4 — the whole
 * point is to stop the two sources from silently fighting over the same row.
 */
export async function syncDirectory(): Promise<SyncResult> {
  let count = 0;
  for (const a of ROSTER) {
    const slug = slugify(a.name);
    await sql`
      insert into agents (slug, name, email, phone, fub_phone, tier, role, dept, hours,
                          seniority_rank, quick_links, raw)
      values (
        ${slug}, ${a.name}, ${a.email.toLowerCase()}, ${a.phone ?? null}, ${a.fubPhone ?? null},
        ${a.tier}::agent_tier, ${a.role ?? null}, ${a.dept ?? null}, ${a.hours ?? null},
        ${tierRank[a.tier] ?? 9}, ${j(QUICK_LINKS)}, ${j(a)}
      )
      on conflict (email) do update set
        name = excluded.name,
        phone = excluded.phone,
        fub_phone = excluded.fub_phone,
        tier = excluded.tier,
        role = excluded.role,
        dept = excluded.dept,
        hours = excluded.hours,
        seniority_rank = excluded.seniority_rank,
        raw = excluded.raw,
        updated_at = now()
      where agents.directory_synced_at is null
    `;
    count++;
  }

  // Enrich with FUB user ids (best-effort).
  const fub = fubClient();
  if (fub) {
    try {
      const users = await fub.users();
      for (const u of users as Array<{ id?: unknown; email?: string }>) {
        if (!u.email || u.id == null) continue;
        await sql`
          update agents set fub_user_id = ${String(u.id)}, updated_at = now()
          where lower(email) = ${u.email.toLowerCase()}
        `;
      }
    } catch {
      // FUB optional for directory sync
    }
  }

  return { source: 'directory', records: count };
}
