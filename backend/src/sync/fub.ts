import { sql, j } from '../db/client.js';
import { fubClient } from '../connectors/fub.js';
import { env } from '../env.js';
import { parseDate, parseDateTime, parseNumber, trim } from '../util/text.js';
import type { SyncResult } from './runner.js';

type Rec = Record<string, unknown>;

const pick = (o: Rec, ...keys: string[]): unknown => {
  for (const k of keys) if (o[k] != null) return o[k];
  return undefined;
};

function firstValue(arr: unknown): string | null {
  if (Array.isArray(arr) && arr.length) {
    const v = arr[0] as { value?: string };
    return trim(v?.value ?? '') || null;
  }
  return null;
}

function mapDealStatus(raw: string): string {
  const s = raw.toLowerCase();
  if (/won|closed|sold/.test(s)) return 'won';
  if (/lost|dead|cancel/.test(s)) return 'lost';
  if (/archiv/.test(s)) return 'archived';
  if (/active|open|pending|under/.test(s)) return 'open';
  return s ? 'unknown' : 'open';
}

/**
 * Mirror Follow Up Boss into Supabase: schema catalog, people→contacts,
 * deals→deals, plus tasks, notes, appointments. Also caches the schema view.
 */
export async function syncFub(): Promise<SyncResult> {
  const fub = fubClient();
  if (!fub) throw new Error('FUB not configured (FUB_API_KEY)');

  // ── schema catalog (pipelines, stages, custom fields) ──
  const [pipelines, stages, customFields] = await Promise.all([
    fub.pipelines().catch(() => []),
    fub.stages().catch(() => []),
    fub.customFields().catch(() => []),
  ]);
  const stageById = new Map<string, string>();
  for (const s of stages as Rec[]) stageById.set(String(s.id), trim(s.name));
  await cacheSchema(pipelines as Rec[], stages as Rec[], customFields as Rec[]);

  const adminIds = new Set(env.FUB_ADMIN_USER_IDS.map(String));

  // ── people → contacts ──
  const people = (await fub.people({ sort: '-updated' })) as Rec[];
  for (const p of people) {
    await sql`
      insert into contacts (
        fub_person_id, name, email, phone, tags, stage, source,
        assigned_user_id, assigned_name, created_at_fub, last_activity_at, person_url, raw
      ) values (
        ${String(p.id)}, ${trim(p.name) || null}, ${firstValue(p.emails)}, ${firstValue(p.phones)},
        ${(p.tags as string[]) ?? []}, ${trim(pick(p, 'stage')) || null}, ${trim(p.source) || null},
        ${p.assignedUserId != null ? String(p.assignedUserId) : null}, ${trim(p.assignedTo) || null},
        ${parseDateTime(p.created)}, ${parseDateTime(pick(p, 'lastActivity', 'updated'))},
        ${`https://app.followupboss.com/2/people/view/${p.id}`}, ${j(p)}
      )
      on conflict (fub_person_id) do update set
        name = excluded.name, email = excluded.email, phone = excluded.phone,
        tags = excluded.tags, stage = excluded.stage, source = excluded.source,
        assigned_user_id = excluded.assigned_user_id, assigned_name = excluded.assigned_name,
        last_activity_at = excluded.last_activity_at, person_url = excluded.person_url,
        raw = excluded.raw, updated_at = now()
    `;
  }
  // resolve assigned_agent_id from fub_user_id
  await sql`
    update contacts c set assigned_agent_id = a.id
    from agents a where a.fub_user_id is not null and a.fub_user_id = c.assigned_user_id
      and (c.assigned_agent_id is distinct from a.id)
  `;

  // ── deals ──
  const deals = (await fub.deals({ sort: '-updated' })) as Rec[];
  for (const d of deals) {
    const personId = Array.isArray(d.people) && d.people.length ? String(d.people[0]) : null;
    const stageName = trim(pick(d, 'stageName')) || stageById.get(String(d.stageId)) || trim((d.stage as Rec)?.name);
    const status = mapDealStatus(trim(pick(d, 'status', 'dealStatus')));
    await sql`
      insert into deals (
        fub_deal_id, fub_person_id, title, price, stage, pipeline_id, status,
        close_date, agent_name, deal_url, person_url, raw
      ) values (
        ${String(d.id)}, ${personId},
        ${trim(d.name) || null}, ${parseNumber(d.price)}, ${stageName || null},
        ${d.pipelineId != null ? String(d.pipelineId) : null}, ${status},
        ${parseDate(pick(d, 'projectedCloseDate', 'closeDate'))},
        ${trim(pick(d, 'agentName')) || null},
        ${`https://app.followupboss.com/2/deals/${d.id}`},
        ${personId ? `https://app.followupboss.com/2/people/view/${personId}` : null},
        ${j(d)}
      )
      on conflict (fub_deal_id) do update set
        title = excluded.title, price = excluded.price,
        stage = excluded.stage, pipeline_id = excluded.pipeline_id, status = excluded.status,
        close_date = excluded.close_date, agent_name = excluded.agent_name, raw = excluded.raw,
        updated_at = now()
    `;
  }
  // Resolve relationships after inserts (avoids nested-subquery parameters).
  await sql`
    update deals d set contact_id = c.id from contacts c
    where c.fub_person_id = d.fub_person_id and (d.contact_id is distinct from c.id)
  `;
  await sql`
    update deals d set agent_id = a.id from agents a
    where d.agent_name is not null and lower(a.name) = lower(d.agent_name)
      and (d.agent_id is distinct from a.id)
  `;

  // ── tasks, notes, appointments (recent) ──
  const tasks = (await fub.tasks({ sort: '-created' }).catch(() => [])) as Rec[];
  for (const t of tasks) {
    const personId = t.personId != null ? String(t.personId) : null;
    const completed = Boolean(pick(t, 'isCompleted', 'completed')) || /completed|done/i.test(trim(t.status));
    const assignee = t.assignedUserId != null ? String(t.assignedUserId) : null;
    await sql`
      insert into tasks (fub_task_id, fub_person_id, title, completed, due_date,
                         assigned_user_id, is_admin, raw)
      values (${String(t.id)}, ${personId},
        ${trim(pick(t, 'name', 'title')) || null}, ${completed}, ${parseDate(t.dueDate)},
        ${assignee}, ${assignee ? adminIds.has(assignee) : false}, ${j(t)})
      on conflict (fub_task_id) do update set
        completed = excluded.completed, due_date = excluded.due_date, title = excluded.title,
        is_admin = excluded.is_admin, raw = excluded.raw, updated_at = now()
    `;
  }
  await sql`
    update tasks t set contact_id = c.id from contacts c
    where c.fub_person_id = t.fub_person_id and (t.contact_id is distinct from c.id)
  `;

  const notes = (await fub.notes({ sort: '-created' }).catch(() => [])) as Rec[];
  for (const n of notes) {
    const personId = n.personId != null ? String(n.personId) : null;
    await sql`
      insert into notes (fub_note_id, fub_person_id, body, author, created_at_fub, raw)
      values (${String(n.id)}, ${personId},
        ${trim(pick(n, 'body', 'note')) || null}, ${trim(pick(n, 'createdBy', 'author')) || null},
        ${parseDateTime(n.created)}, ${j(n)})
      on conflict (fub_note_id) do update set body = excluded.body, raw = excluded.raw
    `;
  }
  await sql`
    update notes n set contact_id = c.id from contacts c
    where c.fub_person_id = n.fub_person_id and (n.contact_id is distinct from c.id)
  `;

  const appts = (await fub.appointments({ sort: '-start' }).catch(() => [])) as Rec[];
  for (const ap of appts) {
    const personId = Array.isArray(ap.invitees) && ap.invitees.length
      ? String((ap.invitees[0] as Rec).personId ?? '')
      : ap.personId != null ? String(ap.personId) : null;
    await sql`
      insert into appointments (fub_appt_id, fub_person_id, title, starts_at, ends_at, status, raw)
      values (${String(ap.id)}, ${personId || null},
        ${trim(pick(ap, 'title', 'description')) || null}, ${parseDateTime(ap.start)},
        ${parseDateTime(ap.end)}, ${trim(ap.status) || null}, ${j(ap)})
      on conflict (fub_appt_id) do update set
        starts_at = excluded.starts_at, ends_at = excluded.ends_at, status = excluded.status, raw = excluded.raw
    `;
  }
  await sql`
    update appointments ap set contact_id = c.id from contacts c
    where c.fub_person_id = ap.fub_person_id and (ap.contact_id is distinct from c.id)
  `;

  return {
    source: 'fub',
    records: people.length + deals.length,
    meta: {
      contacts: people.length,
      deals: deals.length,
      tasks: tasks.length,
      notes: notes.length,
      appointments: appts.length,
    },
  };
}

async function cacheSchema(pipelines: Rec[], stages: Rec[], customFields: Rec[]): Promise<void> {
  const payload = {
    customFields: customFields.map((c) => ({
      id: String(c.id),
      name: trim(c.name),
      label: trim(pick(c, 'label', 'name')),
      type: trim(c.type),
      entity: trim(pick(c, 'entity', 'type')),
      options: (c.choices as string[]) ?? [],
    })),
    stages: stages.map((s) => ({
      id: String(s.id),
      name: trim(s.name),
      pipelineId: s.pipelineId != null ? String(s.pipelineId) : null,
      order: Number(pick(s, 'order', 'position')) || 0,
    })),
    pipelines: pipelines.map((p) => ({ id: String(p.id), name: trim(p.name) })),
  };
  await sql`
    insert into external_cache (key, payload, expires_at, updated_at)
    values ('fub:schema', ${j(payload)}, now() + interval '10 minutes', now())
    on conflict (key) do update set payload = excluded.payload, expires_at = excluded.expires_at, updated_at = now()
  `;
}
