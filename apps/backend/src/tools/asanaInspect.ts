import { env } from '../env.js';
import { log } from '../logger.js';
import {
  getMe,
  listWorkspaces,
  typeaheadUsers,
  listProjects,
  listPortfolios,
  type AsanaNamed,
} from '../connectors/asana.js';

/**
 * `npm run asana:inspect` — read-only discovery of the GIDs the Asana integration
 * needs. Prints workspaces, members, portfolios, and projects so you can paste
 * the right ids into Railway env (ASANA_WORKSPACE_GID, ASANA_LISTINGS_PORTFOLIO_GID,
 * ASANA_AGENT_PORTFOLIOS_JSON, ASANA_TIM_USER_GID, ASANA_ELLIE_USER_GID,
 * ASANA_MARKETING_PROJECT_GID). It never writes to Asana.
 *
 * If ASANA_WORKSPACE_GID is already set it focuses on that workspace; otherwise it
 * walks every workspace the token can see.
 *
 * Pass a search term to filter every list (handy on huge shared workspaces):
 *   npm run asana:inspect ellie
 *   npm run asana:inspect "seller transactions"
 */

const PROJECT_CAP = 50;

function matches(filter: string, ...fields: Array<string | null | undefined>): boolean {
  if (!filter) return true;
  return fields.some((f) => (f ?? '').toLowerCase().includes(filter));
}

function row(gid: string, name?: string | null, extra?: string | null): void {
  const label = name?.trim() || '(unnamed)';
  console.log(`    ${gid}\t${label}${extra ? `  <${extra}>` : ''}`);
}

async function inspectWorkspace(ws: AsanaNamed, ownerGid: string, filter: string): Promise<void> {
  console.log('');
  console.log(`Workspace: ${ws.name ?? '(unnamed)'}`);
  console.log(`  ASANA_WORKSPACE_GID=${ws.gid}`);

  console.log('');
  console.log('  Members (pick Tim/Ellie for ASANA_TIM_USER_GID / ASANA_ELLIE_USER_GID):');
  if (!filter) {
    console.log('    (large workspace — pass a name to find someone, e.g. `npm run asana:inspect "ellie ngassa"`)');
  } else {
    try {
      // Typeahead is server-side and works on huge orgs where listing every user truncates.
      const users = await typeaheadUsers(ws.gid, filter);
      if (!users.length) console.log(`    (no members matching "${filter}")`);
      for (const u of users) row(u.gid, u.name, u.email);
    } catch (err) {
      console.log(`    (failed: ${String(err)})`);
    }
  }

  console.log('');
  console.log('  Portfolios you own (for ASANA_LISTINGS_PORTFOLIO_GID / ASANA_AGENT_PORTFOLIOS_JSON):');
  try {
    const portfolios = (await listPortfolios(ws.gid, ownerGid)).filter((p) => matches(filter, p.name));
    if (!portfolios.length) console.log('    (none — Asana only lists portfolios you own)');
    for (const p of portfolios) row(p.gid, p.name);
  } catch (err) {
    console.log(`    (failed: ${String(err)})`);
  }

  console.log('');
  console.log('  Projects (for ASANA_MARKETING_PROJECT_GID; per-listing projects are created automatically):');
  try {
    const all = (await listProjects(ws.gid)).filter((p) => matches(filter, p.name));
    if (!all.length) console.log('    (none)');
    const shown = filter ? all : all.slice(0, PROJECT_CAP);
    for (const p of shown) row(p.gid, p.name);
    if (!filter && all.length > PROJECT_CAP) {
      console.log(`    … ${all.length - PROJECT_CAP} more — pass a search term to narrow.`);
    }
  } catch (err) {
    console.log(`    (failed: ${String(err)})`);
  }
}

async function main(): Promise<void> {
  if (!env.ASANA_TOKEN) {
    log.error(
      'ASANA_TOKEN is not set. Create a Personal Access Token in Asana ' +
        '(Settings → Apps → Developer apps → Personal access tokens), then set ASANA_TOKEN in .env and re-run.',
    );
    process.exit(1);
  }

  const filter = (process.argv[2] ?? '').trim().toLowerCase();
  console.log('Asana discovery (read-only) — copy the GIDs below into your env.');
  if (filter) console.log(`Filtering everything by: "${filter}"`);

  const me = await getMe();
  if (me) {
    console.log('');
    console.log(`Authenticated as: ${me.name ?? '(unknown)'}${me.email ? ` <${me.email}>` : ''}  gid=${me.gid}`);
  }

  // Focus on the configured workspace if present; otherwise discover all.
  let workspaces: AsanaNamed[] = [];
  if (env.ASANA_WORKSPACE_GID) {
    const all = me?.workspaces?.length ? me.workspaces : await listWorkspaces();
    const match = all.find((w) => w.gid === env.ASANA_WORKSPACE_GID);
    workspaces = match ? [match] : [{ gid: env.ASANA_WORKSPACE_GID }];
  } else {
    workspaces = me?.workspaces?.length ? me.workspaces : await listWorkspaces();
  }

  const ownerGid = me?.gid ?? '';
  for (const ws of workspaces) {
    await inspectWorkspace(ws, ownerGid, filter);
  }

  console.log('');
  console.log('Done. ASANA_AGENT_PORTFOLIOS_JSON maps each agent email to their portfolio gid, e.g.');
  console.log('  {"agent@compass.com":"1200000000000001"}');
}

main().catch((err) => {
  log.error('asana:inspect failed', err);
  process.exit(1);
});
