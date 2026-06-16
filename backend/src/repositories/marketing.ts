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
