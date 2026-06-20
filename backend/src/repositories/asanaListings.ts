import { sql, j } from '../db/client.js';
import { env, have } from '../env.js';
import { log } from '../logger.js';
import { addProjectToPortfolio, createProject, createTaskInProject } from '../connectors/asana.js';

type Row = Record<string, unknown>;

type ListingProject = {
  projectGid: string | null;
  projectUrl: string | null;
  seeded: boolean;
};

type SeedTask = {
  kind: string;
  name: string;
  assignee?: 'tim' | 'ellie';
  notes?: string;
};

const DEFAULT_TASKS: SeedTask[] = [
  { kind: 'photos', name: 'Take photos', assignee: 'ellie', notes: 'Capture listing photography for the launch package.' },
  { kind: 'matterport', name: 'Matterport', assignee: 'ellie', notes: 'Capture or coordinate Matterport scan.' },
  { kind: 'floor_plan', name: 'Floor plan', assignee: 'ellie', notes: 'Create or coordinate floor plan delivery.' },
  { kind: 'fact_sheet', name: 'Create fact sheet', assignee: 'tim', notes: 'Build listing fact sheet from seller details and MLS information.' },
  { kind: 'video', name: 'Listing video / reels', assignee: 'tim', notes: 'Create social and listing video assets if requested.' },
  { kind: 'open_house_materials', name: 'Open house materials', assignee: 'tim', notes: 'Prepare open house assets and print-ready materials.' },
];

function agentPortfolioMap(): Record<string, string> {
  if (!env.ASANA_AGENT_PORTFOLIOS_JSON.trim()) return {};
  try {
    const parsed = JSON.parse(env.ASANA_AGENT_PORTFOLIOS_JSON) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [email, gid] of Object.entries(parsed)) {
      if (gid) out[email.toLowerCase()] = String(gid);
    }
    return out;
  } catch (err) {
    log.warn(`invalid ASANA_AGENT_PORTFOLIOS_JSON: ${String(err)}`);
    return {};
  }
}

function assigneeFor(key?: 'tim' | 'ellie'): string | null {
  if (key === 'tim') return env.ASANA_TIM_USER_GID || null;
  if (key === 'ellie') return env.ASANA_ELLIE_USER_GID || null;
  return null;
}

export function asanaAssigneeForName(name?: string | null): string | null {
  const normalized = String(name ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('tim')) return assigneeFor('tim');
  if (normalized.includes('ellie')) return assigneeFor('ellie');
  return null;
}

async function addToPortfolios(listing: Row, projectGid: string): Promise<string[]> {
  const added: string[] = [];
  const portfolioGids = new Set<string>();
  if (env.ASANA_LISTINGS_PORTFOLIO_GID) portfolioGids.add(env.ASANA_LISTINGS_PORTFOLIO_GID);

  const agentEmail = String(listing.agent_email ?? '').trim().toLowerCase();
  const coAgentEmail = String(listing.co_agent_email ?? '').trim().toLowerCase();
  const byEmail = agentPortfolioMap();
  if (agentEmail && byEmail[agentEmail]) portfolioGids.add(byEmail[agentEmail]);
  if (coAgentEmail && byEmail[coAgentEmail]) portfolioGids.add(byEmail[coAgentEmail]);

  for (const portfolioGid of portfolioGids) {
    try {
      await addProjectToPortfolio({ portfolioGid, projectGid });
      added.push(portfolioGid);
    } catch (err) {
      log.warn(`asana portfolio add failed (${portfolioGid}): ${String(err)}`);
    }
  }
  return added;
}

async function seedMarketingTasks(listingId: string, projectGid: string, address: string): Promise<void> {
  for (const spec of DEFAULT_TASKS) {
    try {
      const task = await createTaskInProject({
        projectGid,
        name: `${spec.name} — ${address}`,
        notes: spec.notes,
        assigneeGid: assigneeFor(spec.assignee),
      });
      if (task?.gid) {
        await sql`
          insert into asana_tasks (id, title, listing_id, type, status, completed, url, synced_at)
          values (${task.gid}, ${spec.name + ' — ' + address}, ${listingId}::uuid, ${spec.kind}, 'Open', false,
                  ${task.permalink_url ?? null}, now())
          on conflict (id) do update set listing_id = excluded.listing_id, type = excluded.type, synced_at = now()
        `;
      }
    } catch (err) {
      log.warn(`asana seed task failed (${spec.name}, ${listingId}): ${String(err)}`);
    }
  }
}

/** Ensure the listing has a project, is attached to portfolios, and has seed marketing tasks. */
export async function ensureListingAsanaProject(listingId: string, opts: { seedTasks?: boolean } = {}): Promise<ListingProject> {
  const seedTasks = opts.seedTasks ?? false;
  const [listing] = await sql<Row[]>`
    select l.id, l.address, a.email as agent_email, b.email as co_agent_email,
           l.asana_project_gid, l.asana_project_url, l.asana_seeded_at, l.asana_portfolios
    from listings l
    left join agents a on a.id = l.agent_id
    left join agents b on b.id = l.co_agent_id
    where l.id = ${listingId}::uuid
    limit 1
  `;
  if (!listing) return { projectGid: null, projectUrl: null, seeded: false };
  if (!have.asana()) {
    return {
      projectGid: (listing.asana_project_gid as string | null) ?? null,
      projectUrl: (listing.asana_project_url as string | null) ?? null,
      seeded: Boolean(listing.asana_seeded_at),
    };
  }

  const address = String(listing.address ?? 'Listing');
  let projectGid = (listing.asana_project_gid as string | null) ?? null;
  let projectUrl = (listing.asana_project_url as string | null) ?? null;

  if (!projectGid) {
    const project = await createProject({
      name: address,
      notes: `ASG listing marketing project for ${address}. Created from the seller onboarding / listing workshop flow.`,
    });
    projectGid = project?.gid ?? null;
    projectUrl = project?.permalink_url ?? null;
    if (projectGid) {
      await sql`
        update listings
        set asana_project_gid = ${projectGid}, asana_project_url = ${projectUrl}, updated_at = now()
        where id = ${listingId}::uuid
      `;
    }
  }

  if (!projectGid) return { projectGid: null, projectUrl, seeded: false };

  const portfolios = await addToPortfolios(listing, projectGid);
  if (portfolios.length) {
    await sql`
      update listings
      set asana_portfolios = ${j(portfolios)}, updated_at = now()
      where id = ${listingId}::uuid
    `;
  }

  const alreadySeeded = Boolean(listing.asana_seeded_at);
  if (seedTasks && !alreadySeeded) {
    await seedMarketingTasks(listingId, projectGid, address);
    await sql`
      update listings set asana_seeded_at = now(), marketing_status = 'In Progress', updated_at = now()
      where id = ${listingId}::uuid
    `;
    await sql`
      insert into listing_activity (listing_id, type, label, actor, meta, client_visible)
      values (${listingId}::uuid, 'asana_project_created', 'Marketing project created in Asana', 'Asana',
              ${j({ projectGid, projectUrl, portfolios })}, false)
    `;
  }

  return { projectGid, projectUrl, seeded: seedTasks || alreadySeeded };
}

export const listingMarketingRequestLabel = (kind: string): string => {
  const labels: Record<string, string> = {
    open_house_materials: 'Open House Materials',
    fact_sheet: 'Fact Sheet',
    photos: 'Listing Photos',
    matterport: 'Matterport',
    floor_plan: 'Floor Plan',
    video: 'Video',
    other: 'Marketing Request',
  };
  return labels[kind] ?? labels.other!;
};
