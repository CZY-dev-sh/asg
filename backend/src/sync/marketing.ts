import { sql, j } from '../db/client.js';
import { have } from '../env.js';
import { fetchMarketingTasks } from '../connectors/asana.js';
import { fetchAppointments } from '../connectors/acuity.js';
import { parseDate, parseDateTime, trim } from '../util/text.js';
import type { SyncResult } from './runner.js';

/** Pull Asana marketing tasks + Acuity photo-shoot bookings into Supabase. */
export async function syncMarketing(): Promise<SyncResult> {
  let count = 0;

  if (have.asana()) {
    const tasks = await fetchMarketingTasks();
    for (const t of tasks) {
      const typeField = t.custom_fields?.find((f) =>
        /type|category|request/i.test(f.name ?? ''),
      );
      const agentField = t.custom_fields?.find((f) => /agent/i.test(f.name ?? ''));
      await sql`
        insert into asana_tasks (id, title, agent, type, status, completed, created_at_asana,
                                 due_on, completed_at, url, raw, synced_at)
        values (${t.gid}, ${trim(t.name) || null}, ${agentField?.display_value ?? t.assignee?.name ?? null},
          ${typeField?.display_value ?? null}, ${t.completed ? 'Completed' : 'Open'}, ${t.completed},
          ${parseDateTime(t.created_at)}, ${parseDate(t.due_on)}, ${parseDateTime(t.completed_at)},
          ${t.permalink_url ?? null}, ${j(t)}, now())
        on conflict (id) do update set
          title = excluded.title, agent = excluded.agent, type = excluded.type,
          status = excluded.status, completed = excluded.completed, due_on = excluded.due_on,
          completed_at = excluded.completed_at, raw = excluded.raw, synced_at = now()
      `;
      count++;
    }
  }

  if (have.acuity()) {
    const appts = await fetchAppointments({ max: 200 });
    for (const a of appts) {
      const name = [a.firstName, a.lastName].filter(Boolean).join(' ');
      await sql`
        insert into acuity_appointments (id, title, agent, starts_at, ends_at, client_name,
                                        calendar_id, appointment_type, raw, synced_at)
        values (${String(a.id)}, ${a.type ?? null}, ${a.calendar ?? null}, ${parseDateTime(a.datetime)},
          ${parseDateTime(a.endTime)}, ${name || null}, ${a.calendarID != null ? String(a.calendarID) : null},
          ${a.type ?? null}, ${j(a)}, now())
        on conflict (id) do update set
          starts_at = excluded.starts_at, ends_at = excluded.ends_at, client_name = excluded.client_name,
          appointment_type = excluded.appointment_type, raw = excluded.raw, synced_at = now()
      `;
      count++;
    }
  }

  return { source: 'marketing', records: count };
}
