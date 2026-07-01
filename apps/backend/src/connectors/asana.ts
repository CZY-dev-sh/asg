import { env, have } from '../env.js';
import { httpJson } from '../util/http.js';

export interface AsanaTask {
  gid: string;
  name: string;
  completed: boolean;
  completed_at?: string | null;
  created_at?: string | null;
  due_on?: string | null;
  permalink_url?: string;
  assignee?: { name?: string } | null;
  custom_fields?: Array<{ name?: string; display_value?: string | null }>;
}

const BASE = 'https://app.asana.com/api/1.0';

export async function fetchMarketingTasks(): Promise<AsanaTask[]> {
  if (!have.asana() || !env.ASANA_MARKETING_PROJECT_GID) return [];
  const fields = [
    'name',
    'completed',
    'completed_at',
    'created_at',
    'due_on',
    'permalink_url',
    'assignee.name',
    'custom_fields.name',
    'custom_fields.display_value',
  ].join(',');
  const out: AsanaTask[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`${BASE}/tasks`);
    url.searchParams.set('project', env.ASANA_MARKETING_PROJECT_GID);
    url.searchParams.set('opt_fields', fields);
    url.searchParams.set('limit', '100');
    if (offset) url.searchParams.set('offset', offset);
    const data = await httpJson<{ data: AsanaTask[]; next_page?: { offset?: string } | null }>(
      url.toString(),
      { headers: { Authorization: `Bearer ${env.ASANA_TOKEN}` } },
    );
    out.push(...(data.data ?? []));
    offset = data.next_page?.offset ?? undefined;
  } while (offset && out.length < 2000);
  return out;
}

export async function createAsanaTask(input: {
  name: string;
  notes?: string;
  dueOn?: string;
}): Promise<{ gid: string; permalink_url?: string } | null> {
  if (!have.asana() || !env.ASANA_MARKETING_PROJECT_GID) return null;
  const data = await httpJson<{ data: { gid: string; permalink_url?: string } }>(`${BASE}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.ASANA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        name: input.name,
        notes: input.notes ?? '',
        due_on: input.dueOn,
        projects: [env.ASANA_MARKETING_PROJECT_GID],
        workspace: env.ASANA_WORKSPACE_GID,
      },
    }),
  });
  return data.data ?? null;
}

/** Create a per-listing Asana project (one project per listing). */
export async function createProject(input: {
  name: string;
  notes?: string;
}): Promise<{ gid: string; permalink_url?: string } | null> {
  if (!have.asana()) return null;
  const data = await httpJson<{ data: { gid: string; permalink_url?: string } }>(`${BASE}/projects`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.ASANA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: { name: input.name, notes: input.notes ?? '', workspace: env.ASANA_WORKSPACE_GID },
    }),
  });
  return data.data ?? null;
}

/** Add an existing project to an Asana portfolio. */
export async function addProjectToPortfolio(input: {
  portfolioGid: string;
  projectGid: string;
}): Promise<boolean> {
  if (!have.asana() || !input.portfolioGid || !input.projectGid) return false;
  await httpJson<{ data: unknown }>(`${BASE}/portfolios/${encodeURIComponent(input.portfolioGid)}/addItem`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.ASANA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: { item: input.projectGid },
    }),
  });
  return true;
}

/** Mark a task complete or incomplete — the hub-driven half of two-way sync. */
export async function setTaskCompleted(taskGid: string, completed: boolean): Promise<boolean> {
  if (!have.asana() || !taskGid) return false;
  await httpJson<{ data: unknown }>(`${BASE}/tasks/${encodeURIComponent(taskGid)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${env.ASANA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { completed } }),
  });
  return true;
}

/** Create a task inside a specific project (the listing's project). */
export async function createTaskInProject(input: {
  projectGid: string;
  name: string;
  notes?: string;
  dueOn?: string;
  assigneeGid?: string | null;
}): Promise<{ gid: string; permalink_url?: string } | null> {
  if (!have.asana()) return null;
  const data = await httpJson<{ data: { gid: string; permalink_url?: string } }>(`${BASE}/tasks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.ASANA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        name: input.name,
        notes: input.notes ?? '',
        due_on: input.dueOn,
        assignee: input.assigneeGid || undefined,
        projects: [input.projectGid],
        workspace: env.ASANA_WORKSPACE_GID,
      },
    }),
  });
  return data.data ?? null;
}

// ── Discovery (read-only) ────────────────────────────────────────────────────
// Helpers behind `npm run asana:inspect`: they only need a token (not a full
// have.asana() config) so you can look up the workspace/portfolio/user GIDs the
// rest of the integration consumes.

export interface AsanaNamed {
  gid: string;
  name?: string | null;
}

export interface AsanaUser extends AsanaNamed {
  email?: string | null;
}

async function asanaGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return httpJson<T>(url.toString(), { headers: { Authorization: `Bearer ${env.ASANA_TOKEN}` } });
}

/** The authenticated user (and the workspaces their token can see). */
export async function getMe(): Promise<(AsanaUser & { workspaces?: AsanaNamed[] }) | null> {
  if (!env.ASANA_TOKEN) return null;
  const data = await asanaGet<{ data: AsanaUser & { workspaces?: AsanaNamed[] } }>('/users/me', {
    opt_fields: 'name,email,workspaces.name',
  });
  return data.data ?? null;
}

/** All workspaces the token can access. */
export async function listWorkspaces(): Promise<AsanaNamed[]> {
  if (!env.ASANA_TOKEN) return [];
  const data = await asanaGet<{ data: AsanaNamed[] }>('/workspaces', { opt_fields: 'name', limit: '100' });
  return data.data ?? [];
}

/** Members of a workspace (for the Tim/Ellie assignee GIDs). Uses GET /users with a
 * workspace filter + offset pagination (the /workspaces/:gid/users endpoint 400s on
 * large shared workspaces like compass.com). */
export async function listUsers(workspaceGid: string): Promise<AsanaUser[]> {
  if (!env.ASANA_TOKEN || !workspaceGid) return [];
  const out: AsanaUser[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`${BASE}/users`);
    url.searchParams.set('workspace', workspaceGid);
    url.searchParams.set('opt_fields', 'name,email');
    url.searchParams.set('limit', '100');
    if (offset) url.searchParams.set('offset', offset);
    const data = await httpJson<{ data: AsanaUser[]; next_page?: { offset?: string } | null }>(url.toString(), {
      headers: { Authorization: `Bearer ${env.ASANA_TOKEN}` },
    });
    out.push(...(data.data ?? []));
    offset = data.next_page?.offset ?? undefined;
  } while (offset && out.length < 5000);
  return out;
}

/** Server-side typeahead search for users by name/email — the reliable way to find
 * a member in a large org workspace where full pagination would miss or truncate them. */
export async function typeaheadUsers(workspaceGid: string, query: string): Promise<AsanaUser[]> {
  if (!env.ASANA_TOKEN || !workspaceGid || !query) return [];
  const data = await asanaGet<{ data: AsanaUser[] }>(`/workspaces/${encodeURIComponent(workspaceGid)}/typeahead`, {
    resource_type: 'user',
    query,
    opt_fields: 'name,email',
    count: '50',
  });
  return data.data ?? [];
}

/** Portfolios in a workspace owned by `ownerGid` (Asana only lists an owner's own portfolios). */
export async function listPortfolios(workspaceGid: string, ownerGid: string): Promise<AsanaNamed[]> {
  if (!env.ASANA_TOKEN || !workspaceGid || !ownerGid) return [];
  const data = await asanaGet<{ data: AsanaNamed[] }>('/portfolios', {
    workspace: workspaceGid,
    owner: ownerGid,
    opt_fields: 'name',
    limit: '100',
  });
  return data.data ?? [];
}

/** Projects in a workspace (for the marketing project GID), capped/paginated. */
export async function listProjects(workspaceGid: string): Promise<AsanaNamed[]> {
  if (!env.ASANA_TOKEN || !workspaceGid) return [];
  const out: AsanaNamed[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`${BASE}/projects`);
    url.searchParams.set('workspace', workspaceGid);
    url.searchParams.set('opt_fields', 'name');
    url.searchParams.set('limit', '100');
    if (offset) url.searchParams.set('offset', offset);
    const data = await httpJson<{ data: AsanaNamed[]; next_page?: { offset?: string } | null }>(url.toString(), {
      headers: { Authorization: `Bearer ${env.ASANA_TOKEN}` },
    });
    out.push(...(data.data ?? []));
    offset = data.next_page?.offset ?? undefined;
  } while (offset && out.length < 500);
  return out;
}

/** All tasks in a project (for per-listing status sync). */
export async function fetchProjectTasks(projectGid: string): Promise<AsanaTask[]> {
  if (!have.asana() || !projectGid) return [];
  const fields = ['name', 'completed', 'completed_at', 'created_at', 'due_on', 'permalink_url'].join(',');
  const out: AsanaTask[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`${BASE}/projects/${encodeURIComponent(projectGid)}/tasks`);
    url.searchParams.set('opt_fields', fields);
    url.searchParams.set('limit', '100');
    if (offset) url.searchParams.set('offset', offset);
    const data = await httpJson<{ data: AsanaTask[]; next_page?: { offset?: string } | null }>(
      url.toString(),
      { headers: { Authorization: `Bearer ${env.ASANA_TOKEN}` } },
    );
    out.push(...(data.data ?? []));
    offset = data.next_page?.offset ?? undefined;
  } while (offset && out.length < 500);
  return out;
}
