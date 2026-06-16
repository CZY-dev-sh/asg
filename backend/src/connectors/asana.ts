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
