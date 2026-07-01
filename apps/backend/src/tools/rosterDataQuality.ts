import { sql, closeDb } from '../db/client.js';
import { fubClient } from '../connectors/fub.js';
import { log } from '../logger.js';

/**
 * `npm run roster:data-quality` — read-only audit for the exact failure mode
 * described in docs/AGENT-HUB-PRD.md §4.3/§7: an agent's FUB user email or name
 * doesn't line up with their `agents` row, so their deal tracker/stats silently
 * come back empty with no error anywhere. This never writes anything — it's a
 * report to act on by hand (fixing an email in the sheet, or a name in FUB).
 */

interface AgentRow {
  name: string;
  email: string;
  tier: string;
  active: boolean;
  fub_user_id: string | null;
}

async function main(): Promise<void> {
  const fub = fubClient();
  if (!fub) {
    log.error('FUB_API_KEY not set — cannot cross-check against live FUB users.');
    process.exit(1);
  }

  const agents = await sql<AgentRow[]>`
    select name, email, tier, active, fub_user_id from agents
    where active = true order by tier, name
  `;
  const fubUsers = (await fub.users()) as Array<{ id?: unknown; name?: string; email?: string }>;
  const fubByEmail = new Map(fubUsers.map((u) => [String(u.email ?? '').toLowerCase(), u]));

  console.log('=== Agents with no FUB user match (email mismatch — hub will look empty) ===');
  const unmatched = agents.filter((a) => a.active && !a.fub_user_id);
  if (!unmatched.length) {
    console.log('  none — every active agent has a matching FUB user id.');
  }
  for (const a of unmatched) {
    const fuzzy = fubUsers.find((u) => namesLooselyMatch(u.name, a.name));
    console.log(
      `  ${a.name} <${a.email}> (${a.tier}) — no FUB user with this email.` +
        (fuzzy
          ? ` Possible match by name: "${fuzzy.name}" <${fuzzy.email ?? '(no email)'}> — likely a typo'd email in the roster/sheet.`
          : ' No name-similar FUB user found either — check FUB directly.'),
    );
  }

  console.log('');
  console.log('=== FUB users with no matching active agent (orphaned in the roster) ===');
  const agentEmails = new Set(agents.map((a) => a.email.toLowerCase()));
  const orphaned = fubUsers.filter((u) => u.email && !agentEmails.has(u.email.toLowerCase()));
  if (!orphaned.length) {
    console.log('  none.');
  }
  for (const u of orphaned) {
    console.log(`  ${u.name ?? '(no name)'} <${u.email}> — exists in FUB but not in the agents table.`);
  }

  console.log('');
  console.log('=== Deals with no resolved agent after sync (run `npm run sync:fub` first for fresh data) ===');
  const totalRows = await sql<{ total: number }[]>`select count(*)::int as total from deals`;
  const unmatchedRows = await sql<{ unmatched_deals: number }[]>`
    select count(*)::int as unmatched_deals from deals where agent_id is null
  `;
  const total = totalRows[0]?.total ?? 0;
  const unmatchedDeals = unmatchedRows[0]?.unmatched_deals ?? 0;
  console.log(`  ${unmatchedDeals} / ${total} deals have no agent_id.`);
  if (unmatchedDeals > 0) {
    const samples = await sql<{ title: string | null; agent_name: string | null; fub_deal_id: string }[]>`
      select title, agent_name, fub_deal_id from deals where agent_id is null order by updated_at desc limit 10
    `;
    console.log('  Sample (most recently updated first):');
    for (const d of samples) {
      console.log(`    deal ${d.fub_deal_id} "${d.title ?? '(untitled)'}" — agent_name on file: ${d.agent_name ?? '(blank)'}`);
    }
  }

  await closeDb();
}

function namesLooselyMatch(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const norm = (s: string) => s.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const [af, ...ar] = norm(a);
  const [bf, ...br] = norm(b);
  if (!af || !bf) return false;
  const aLast = ar[ar.length - 1] ?? '';
  const bLast = br[br.length - 1] ?? '';
  return aLast === bLast && (af === bf || af[0] === bf[0]);
}

main().catch(async (err) => {
  log.error('roster:data-quality failed', err);
  await closeDb();
  process.exit(1);
});
