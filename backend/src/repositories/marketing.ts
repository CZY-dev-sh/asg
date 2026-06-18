import { sql } from '../db/client.js';

type Row = Record<string, unknown>;
const iso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : v == null ? null : String(v);

export async function getMarketingRollup(period = '30d') {
  const interval = period === '7d' ? '7 days' : period === 'ytd' ? '365 days' : period === 'all' ? '100 years' : '30 days';
  const asana = await sql<Row[]>`
    select id, title, agent, type, status, created_at_asana, due_on, url, completed
    from asana_tasks order by created_at_asana desc nulls last limit 200
  `;
  const acuity = await sql<Row[]>`
    select id, title, agent, starts_at, ends_at, client_name
    from acuity_appointments where starts_at >= now() - ${interval}::interval or starts_at >= now()
    order by starts_at asc limit 100
  `;
  const [counts] = await sql<Row[]>`
    select
      count(*) filter (where completed = false) as open_count,
      count(*) filter (where completed = true and completed_at >= now() - interval '30 days') as completed30
    from asana_tasks
  `;
  const upcoming = acuity.filter((a) => a.starts_at && new Date(String(a.starts_at)) > new Date()).length;

  const workload = await sql<Row[]>`
    select agent, count(*) filter (where completed = false) as open,
           count(*) filter (where completed = true) as completed
    from asana_tasks where agent is not null group by agent order by open desc
  `;

  return {
    summary: {
      openCount: Number(counts?.open_count ?? 0),
      completed30: Number(counts?.completed30 ?? 0),
      avgTurnaroundDays: null,
      upcomingBookings: upcoming,
    },
    asana: asana.map((t) => ({
      id: t.id, title: t.title, agent: t.agent, type: t.type, status: t.status,
      createdAt: iso(t.created_at_asana),
      dueOn: t.due_on instanceof Date ? t.due_on.toISOString().slice(0, 10) : t.due_on,
      url: t.url,
    })),
    acuity: acuity.map((a) => ({
      id: a.id, title: a.title, agent: a.agent, startsAt: iso(a.starts_at), endsAt: iso(a.ends_at), clientName: a.client_name,
    })),
    workload: workload.map((w) => ({ agent: w.agent, open: Number(w.open), completed: Number(w.completed) })),
    bottlenecks: [],
    turnaround: { byType: [] },
  };
}

/**
 * Admin calendar feed: upcoming Acuity media/meetings (linked to listings where
 * known) plus team events, for the console calendar surface.
 */
export async function getCalendar(opts: { days?: number } = {}) {
  const days = opts.days ?? 60;
  const appts = await sql<Row[]>`
    select aa.id, aa.title, aa.agent, aa.appointment_type, aa.starts_at, aa.ends_at,
           aa.client_name, aa.property_address, aa.status, aa.listing_id,
           l.address as listing_address, l.slug as listing_slug
    from acuity_appointments aa
    left join listings l on l.id = aa.listing_id
    where aa.starts_at >= now() - interval '1 day'
      and aa.starts_at <= now() + ${`${days} days`}::interval
    order by aa.starts_at asc
  `;
  let events: Row[] = [];
  try {
    events = await sql<Row[]>`
      select id, title, starts_at, ends_at, all_day, location, audience
      from team_events
      where starts_at >= now() - interval '1 day' and starts_at <= now() + ${`${days} days`}::interval
      order by starts_at asc`;
  } catch {
    events = [];
  }
  return {
    ok: true,
    appointments: appts.map((a) => ({
      id: a.id,
      title: a.title ?? a.appointment_type,
      type: a.appointment_type,
      agent: a.agent,
      clientName: a.client_name,
      startsAt: iso(a.starts_at),
      endsAt: iso(a.ends_at),
      status: a.status,
      listingId: a.listing_id ?? null,
      listingAddress: a.listing_address ?? a.property_address ?? null,
      listingSlug: a.listing_slug ?? null,
    })),
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: iso(e.starts_at),
      endsAt: iso(e.ends_at),
      allDay: Boolean(e.all_day),
      location: e.location,
      audience: e.audience,
    })),
  };
}

const MEETING_RE = /meeting|consult|onboarding|strategy|design|touch-?up|edit/i;
const SHOOT_RE = /photo|video|matterport|shoot|floor\s*plan|aerial|headshot|twilight|drone|3d|content|reel|tour/i;

function classify(type: string): 'shoot' | 'meeting' | 'other' {
  if (MEETING_RE.test(type)) return 'meeting';
  if (SHOOT_RE.test(type)) return 'shoot';
  return 'other';
}

/** Pull the "Add Ons" list out of an Acuity appointment description. */
function parseAddOns(notes: string | null): string[] {
  if (!notes) return [];
  const m = notes.match(
    /add\s*ons\s*\n=+\n([\s\S]*?)(?:\n\s*\n|\nlisting details|\nrental photos|\nlisting video|\nadmin routing|\nsocial media|\nnotes::|\ndetails\b|$)/i,
  );
  if (!m || !m[1]) return [];
  return m[1]
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s && !/^=+$/.test(s));
}

/**
 * One consolidated payload for the Marketing dashboard: the upcoming schedule
 * (rich Acuity detail, linked to listings), plus team-performance rollups from
 * Acuity (shoots per photographer, agents served), Asana (task workload) and
 * Gmail (deliveries). Asana/Gmail simply read empty until those are connected.
 */
export async function getMarketingDashboard(days = 30) {
  const appRows = await sql<Row[]>`
    select aa.id, aa.appointment_type, aa.agent, aa.client_name, aa.starts_at, aa.ends_at,
           aa.property_address, aa.status, aa.listing_id, aa.raw->>'notes' as notes,
           l.address as listing_address, l.slug as listing_slug, l.status as listing_status
    from acuity_appointments aa
    left join listings l on l.id = aa.listing_id
    where aa.starts_at >= now() - interval '2 days'
    order by aa.starts_at asc
    limit 400
  `;

  const now = Date.now();
  const weekAhead = now + 7 * 86_400_000;
  const appointments = appRows.map((a) => {
    const type = String(a.appointment_type ?? '');
    const kind = classify(type);
    return {
      id: a.id,
      type,
      kind,
      isShoot: kind === 'shoot',
      client: a.client_name ?? null,
      photographer: a.agent ?? null,
      startsAt: iso(a.starts_at),
      endsAt: iso(a.ends_at),
      address: a.property_address ?? null,
      status: a.status ?? null,
      listingId: a.listing_id ?? null,
      listingSlug: a.listing_slug ?? null,
      listingAddress: a.listing_address ?? a.property_address ?? null,
      listingStatus: a.listing_status ?? null,
      addOns: parseAddOns(a.notes as string | null),
      notes: a.notes ?? null,
    };
  });

  const future = appointments.filter((a) => a.startsAt && new Date(a.startsAt).getTime() >= now);
  const byPhotographer = new Map<string, number>();
  const byClient = new Map<string, { shoots: number; total: number }>();
  for (const a of appointments) {
    if (a.photographer) {
      byPhotographer.set(String(a.photographer), (byPhotographer.get(String(a.photographer)) ?? 0) + (a.isShoot ? 1 : 0));
    }
    const c = String(a.client ?? '').trim();
    if (c) {
      const e = byClient.get(c) ?? { shoots: 0, total: 0 };
      e.total += 1;
      if (a.isShoot) e.shoots += 1;
      byClient.set(c, e);
    }
  }

  const output = await getMarketingOutput(days);
  const rollup = await getMarketingRollup(days <= 7 ? '7d' : days >= 365 ? 'ytd' : '30d');

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    period: { days },
    connections: {
      acuity: appointments.length > 0,
      asana: rollup.workload.length > 0 || rollup.asana.length > 0,
      gmail: output.stats.total > 0,
    },
    kpis: {
      upcomingShoots: future.filter((a) => a.isShoot).length,
      thisWeek: future.filter((a) => a.startsAt && new Date(a.startsAt).getTime() <= weekAhead).length,
      openTasks: rollup.summary.openCount,
      completed30: rollup.summary.completed30,
      deliveries: output.stats.total,
    },
    appointments,
    team: {
      photographers: [...byPhotographer.entries()]
        .map(([name, shoots]) => ({ name, shoots }))
        .sort((a, b) => b.shoots - a.shoots),
      topClients: [...byClient.entries()]
        .map(([name, v]) => ({ name, shoots: v.shoots, total: v.total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 12),
      asanaWorkload: rollup.workload,
      gmailByPerson: Object.entries(output.stats.byPerson)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12),
      gmailByCategory: Object.entries(output.stats.byCategory)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
    },
    asana: { connected: rollup.workload.length > 0, recent: rollup.asana.slice(0, 12) },
    gmail: { connected: output.stats.total > 0, total: output.stats.total, recent: output.emails.slice(0, 20) },
  };
}

export async function getMarketingOutput(days = 30) {
  const interval = days === 0 ? '100 years' : `${days} days`;
  const emails = await sql<Row[]>`
    select id, subject, category, person, property, direction, ts
    from marketing_emails where ts >= now() - ${interval}::interval order by ts desc limit 2000
  `;
  const byCategory: Record<string, number> = {};
  const byPerson: Record<string, number> = {};
  for (const e of emails) {
    const cat = String(e.category ?? 'Uncategorized');
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    if (e.person) byPerson[String(e.person)] = (byPerson[String(e.person)] ?? 0) + 1;
  }
  return {
    ok: true,
    meta: { generatedAt: new Date().toISOString(), days, total: emails.length },
    emails: emails.map((e) => ({
      id: e.id, subject: e.subject, category: e.category, person: e.person, property: e.property,
      direction: e.direction, ts: iso(e.ts),
    })),
    stats: { byCategory, byPerson, total: emails.length },
  };
}
