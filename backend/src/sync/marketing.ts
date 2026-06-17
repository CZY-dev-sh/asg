import { sql, j } from '../db/client.js';
import { have } from '../env.js';
import { fetchMarketingTasks, fetchProjectTasks } from '../connectors/asana.js';
import {
  fetchAppointments,
  addressFromAppointment,
  isMediaAppointment,
  type AcuityAppointment,
} from '../connectors/acuity.js';
import { parseDate, parseDateTime, trim, normalizeAddress } from '../util/text.js';
import type { SyncResult } from './runner.js';

type Row = Record<string, unknown>;

/** Pull Asana marketing tasks + Acuity photo-shoot bookings into Supabase, then
 * link bookings to listings and reflect Asana task status onto open requests. */
export async function syncMarketing(): Promise<SyncResult> {
  let count = 0;

  if (have.asana()) {
    const tasks = await fetchMarketingTasks();
    for (const t of tasks) {
      const typeField = t.custom_fields?.find((f) => /type|category|request/i.test(f.name ?? ''));
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
      count += await upsertAppointment(a);
    }
  }

  // Reflect Asana task status onto the listing requests they fulfill.
  await syncListingRequestStatus();

  return { source: 'marketing', records: count };
}

/** Upsert one Acuity appointment and link it to its listing (by address). */
async function upsertAppointment(a: AcuityAppointment): Promise<number> {
  const name = [a.firstName, a.lastName].filter(Boolean).join(' ');
  const propertyAddress = addressFromAppointment(a);
  const startsAt = parseDateTime(a.datetime);

  // Resolve the listing this booking is for (exact normalized address).
  let listingId: string | null = null;
  if (propertyAddress) {
    const norm = normalizeAddress(propertyAddress);
    const [match] = await sql<Row[]>`
      select id from listings where address_normalized = ${norm} limit 1`;
    listingId = match ? String(match.id) : null;
  }

  // Was this appointment already linked? (avoid re-logging the milestone)
  const [prior] = await sql<Row[]>`select listing_id from acuity_appointments where id = ${String(a.id)}`;
  const wasLinked = Boolean(prior?.listing_id);

  await sql`
    insert into acuity_appointments (id, title, agent, starts_at, ends_at, client_name,
                                     calendar_id, appointment_type, listing_id, property_address,
                                     status, raw, synced_at)
    values (${String(a.id)}, ${a.type ?? null}, ${a.calendar ?? null}, ${startsAt},
      ${parseDateTime(a.endTime)}, ${name || null}, ${a.calendarID != null ? String(a.calendarID) : null},
      ${a.type ?? null}, ${listingId}::uuid, ${propertyAddress}, 'Scheduled', ${j(a)}, now())
    on conflict (id) do update set
      starts_at = excluded.starts_at, ends_at = excluded.ends_at, client_name = excluded.client_name,
      appointment_type = excluded.appointment_type,
      listing_id = coalesce(excluded.listing_id, acuity_appointments.listing_id),
      property_address = coalesce(excluded.property_address, acuity_appointments.property_address),
      raw = excluded.raw, synced_at = now()
  `;

  // For a media shoot, reflect the schedule on the listing + timeline.
  if (listingId && isMediaAppointment(a)) {
    await sql`
      update listings set
        photos_status = case when coalesce(photos_status,'') in ('', 'Not Booked', 'Requested', 'Booked') then 'Scheduled' else photos_status end,
        photos_datetime = ${startsAt},
        photos_booking_id = ${String(a.id)},
        updated_at = now()
      where id = ${listingId}::uuid`;
    if (!wasLinked) {
      await sql`
        insert into listing_activity (listing_id, type, label, actor, meta, client_visible)
        values (${listingId}::uuid, 'photos_scheduled',
                ${'Photos scheduled' + (startsAt ? ' for ' + new Date(startsAt).toLocaleString() : '')},
                ${a.calendar ?? 'Acuity'}, ${j({ appointmentId: a.id, type: a.type })}, true)`;
    }
  }
  return 1;
}

/**
 * Pull each listing project's tasks from Asana and move its open requests to
 * delivered when the matching task completes. Open task → in_progress;
 * completed → delivered (and the listing's per-asset status flips to Delivered).
 */
async function syncListingRequestStatus(): Promise<void> {
  if (!have.asana()) return;
  const listings = await sql<Row[]>`
    select id, asana_project_gid from listings where asana_project_gid is not null`;
  for (const l of listings) {
    const projectGid = String(l.asana_project_gid);
    const listingId = String(l.id);
    let tasks;
    try {
      tasks = await fetchProjectTasks(projectGid);
    } catch {
      continue;
    }
    const byGid = new Map(tasks.map((t) => [t.gid, t]));
    const requests = await sql<Row[]>`
      select id, kind, status, asana_task_gid from listing_requests
      where listing_id = ${listingId}::uuid and asana_task_gid is not null and status <> 'delivered'`;
    for (const r of requests) {
      const task = byGid.get(String(r.asana_task_gid));
      if (!task) continue;
      if (task.completed) {
        await sql`update listing_requests set status = 'delivered', delivered_at = now() where id = ${String(r.id)}::uuid`;
        const col = REQUEST_DELIVERED_COL[String(r.kind)] ?? {};
        if (col.status)
          await sql`update listings set ${sql(col.status)} = 'Delivered' where id = ${listingId}::uuid`;
        if (col.deliveredAt)
          await sql`update listings set ${sql(col.deliveredAt)} = now() where id = ${listingId}::uuid`;
        await sql`
          insert into listing_activity (listing_id, type, label, actor, meta, client_visible)
          values (${listingId}::uuid, 'materials_delivered', ${'Delivered: ' + String(task.name ?? r.kind)}, 'Asana', ${j({ requestId: r.id })}, true)`;
      } else if (String(r.status) === 'requested') {
        await sql`update listing_requests set status = 'in_progress' where id = ${String(r.id)}::uuid`;
      }
    }
    // Roll the listing marketing_status up from its open requests.
    const [open] = await sql<Row[]>`
      select count(*)::int as n from listing_requests where listing_id = ${listingId}::uuid and status <> 'delivered'`;
    await sql`update listings set marketing_status = ${Number(open?.n ?? 0) > 0 ? 'In Progress' : 'Done'} where id = ${listingId}::uuid`;
  }
}

const REQUEST_DELIVERED_COL: Record<string, { status?: string; deliveredAt?: string }> = {
  open_house_materials: { status: 'open_house_materials_status', deliveredAt: 'open_house_materials_delivered_at' },
  fact_sheet: { status: 'fact_sheet_status', deliveredAt: 'fact_sheet_delivered_at' },
  photos: { status: 'photos_status', deliveredAt: 'photos_delivered_at' },
  matterport: { status: 'matterport_status', deliveredAt: 'matterport_delivered_at' },
  floor_plan: { status: 'floor_plan_status', deliveredAt: 'floor_plan_delivered_at' },
  video: { status: 'video_status', deliveredAt: 'video_delivered_at' },
  other: {},
};

/**
 * Handle a single Acuity webhook delivery (realtime). The webhook only carries
 * ids, so we refetch and reuse the same matching as the poll.
 */
export async function handleAcuityWebhook(appointmentId: string): Promise<{ ok: boolean; linked: boolean }> {
  if (!have.acuity() || !appointmentId) return { ok: false, linked: false };
  const appts = await fetchAppointments({ max: 50 });
  const appt = appts.find((a) => String(a.id) === String(appointmentId));
  if (!appt) return { ok: true, linked: false };
  await upsertAppointment(appt);
  const [row] = await sql<Row[]>`select listing_id from acuity_appointments where id = ${String(appointmentId)}`;
  return { ok: true, linked: Boolean(row?.listing_id) };
}
