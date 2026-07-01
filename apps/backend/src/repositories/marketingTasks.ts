import { sql, j } from '../db/client.js';
import { env, have } from '../env.js';
import { log } from '../logger.js';
import { createTaskInProject, setTaskCompleted } from '../connectors/asana.js';
import { asanaAssigneeForName } from './asanaListings.js';

type Row = Record<string, unknown>;

export type TaskStatus = 'requested' | 'in_progress' | 'done' | 'cancelled';

export interface CreateTaskInput {
  agentId: string;
  title: string;
  category?: string;
  notes?: string | null;
  assignee?: string | null;
  dueOn?: string | null;
  listingId?: string | null;
  requestedBy?: string | null;
  source?: 'agent_portal' | 'admin' | 'onboarding';
  materials?: unknown;
}

/** email (lowercase) → "Requests - <Agent>" Asana project gid, for mirroring general tasks. */
function agentRequestProjectMap(): Record<string, string> {
  if (!env.ASANA_AGENT_REQUEST_PROJECTS_JSON.trim()) return {};
  try {
    const parsed = JSON.parse(env.ASANA_AGENT_REQUEST_PROJECTS_JSON) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [email, gid] of Object.entries(parsed)) if (gid) out[email.toLowerCase()] = String(gid);
    return out;
  } catch (err) {
    log.warn(`invalid ASANA_AGENT_REQUEST_PROJECTS_JSON: ${String(err)}`);
    return {};
  }
}

async function resolveAgentRequestProject(agentId: string): Promise<string | null> {
  const map = agentRequestProjectMap();
  if (!Object.keys(map).length) return null;
  const [agent] = await sql<Row[]>`select email from agents where id = ${agentId}::uuid`;
  const email = String(agent?.email ?? '').trim().toLowerCase();
  return email && map[email] ? map[email] : null;
}

/** Create a general (or listing-linked) marketing task; best-effort mirror to Asana. */
export async function createTask(input: CreateTaskInput): Promise<Row> {
  const materials = Array.isArray(input.materials) ? input.materials : input.materials ? [input.materials] : [];
  const [task] = await sql<Row[]>`
    insert into marketing_tasks
      (agent_id, listing_id, title, category, status, assignee, notes, materials, requested_by, due_on, source)
    values (${input.agentId}::uuid, ${input.listingId ?? null}, ${input.title}, ${input.category ?? 'general'}, 'requested',
            ${input.assignee ?? null}, ${input.notes ?? null}, ${j(materials)}, ${input.requestedBy ?? null},
            ${input.dueOn ?? null}, ${input.source ?? 'admin'})
    returning *`;
  const taskId = String(task!.id);

  if (have.asana()) {
    try {
      const projectGid = await resolveAgentRequestProject(input.agentId);
      if (projectGid) {
        const created = await createTaskInProject({
          projectGid,
          name: input.title,
          notes: input.notes ?? undefined,
          dueOn: input.dueOn ?? undefined,
          assigneeGid: asanaAssigneeForName(input.assignee),
        });
        if (created?.gid) {
          await sql`
            update marketing_tasks
            set asana_task_gid = ${created.gid}, asana_task_url = ${created.permalink_url ?? null},
                asana_project_gid = ${projectGid}, status = 'in_progress'
            where id = ${taskId}::uuid`;
        }
      }
    } catch (err) {
      log.warn(`marketing task asana mirror failed (${taskId}): ${String(err)}`);
    }
  }

  return (await sql<Row[]>`select * from marketing_tasks where id = ${taskId}::uuid`)[0]!;
}

/** Set a task's status; best-effort mirror completion to Asana. Returns null if missing. */
export async function setStatus(taskId: string, status: TaskStatus): Promise<Row | null> {
  const [task] = await sql<Row[]>`select id, asana_task_gid from marketing_tasks where id = ${taskId}::uuid`;
  if (!task) return null;

  if (status === 'done') {
    await sql`update marketing_tasks set status = 'done', completed_at = now() where id = ${taskId}::uuid`;
  } else {
    await sql`update marketing_tasks set status = ${status}, completed_at = null where id = ${taskId}::uuid`;
  }

  if (have.asana() && task.asana_task_gid) {
    try {
      await setTaskCompleted(String(task.asana_task_gid), status === 'done');
    } catch (err) {
      log.warn(`asana complete mirror failed (task ${taskId}): ${String(err)}`);
    }
  }
  return (await sql<Row[]>`select * from marketing_tasks where id = ${taskId}::uuid`)[0] ?? null;
}

/** Reassign a task to another agent and/or change the doer (assignee). */
export async function reassign(taskId: string, agentId?: string | null, assignee?: string | null): Promise<Row | null> {
  const [task] = await sql<Row[]>`select id from marketing_tasks where id = ${taskId}::uuid`;
  if (!task) return null;
  if (agentId) await sql`update marketing_tasks set agent_id = ${agentId}::uuid where id = ${taskId}::uuid`;
  if (assignee !== undefined) await sql`update marketing_tasks set assignee = ${assignee} where id = ${taskId}::uuid`;
  return (await sql<Row[]>`select * from marketing_tasks where id = ${taskId}::uuid`)[0] ?? null;
}

/** All marketing work (general + listing) for one agent, newest first. */
export async function listForAgent(agentId: string): Promise<Row[]> {
  return sql<Row[]>`
    select source, id, agent_id, listing_id, title, kind, status, assignee, due_on, requested_at, completed_at, asana_task_url
    from v_marketing_work
    where agent_id = ${agentId}::uuid
    order by (status in ('requested','in_progress')) desc, requested_at desc`;
}

/** Per-agent workload rollup across general tasks + listing requests. */
export async function agentWorkload(): Promise<Row[]> {
  return sql<Row[]>`
    select w.agent_id, a.name as agent_name, a.email as agent_email,
           count(*) filter (where w.status in ('requested','in_progress')) as open,
           count(*) filter (where w.status = 'in_progress') as in_progress,
           count(*) filter (where w.status = 'done') as done
    from v_marketing_work w
    join agents a on a.id = w.agent_id
    group by w.agent_id, a.name, a.email
    order by open desc, a.name asc`;
}
