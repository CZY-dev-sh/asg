import { sql, j } from '../db/client.js';

type Row = Record<string, unknown>;
const iso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : v == null ? null : String(v);

export interface UsageEvent {
  type?: string;
  page?: string;
  label?: string;
  url?: string;
  visitor_id?: string;
  agent_email?: string;
  agent_name?: string;
  session_id?: string;
  user_agent?: string;
  referrer?: string;
  meta?: Record<string, unknown>;
}

export async function insertUsageEvent(e: UsageEvent): Promise<void> {
  await sql`
    insert into usage_events (type, page, label, url, visitor_id, agent_email, agent_name,
                              session_id, user_agent, referrer, meta)
    values (${e.type ?? null}, ${e.page ?? null}, ${e.label ?? null}, ${e.url ?? null},
      ${e.visitor_id ?? null}, ${e.agent_email ?? null}, ${e.agent_name ?? null},
      ${e.session_id ?? null}, ${e.user_agent ?? null}, ${e.referrer ?? null},
      ${j(e.meta ?? {})})
  `;
}

function periodInterval(period: string): string {
  switch (period) {
    case '7d':
      return '7 days';
    case 'ytd':
      return '365 days';
    case 'all':
      return '100 years';
    case '30d':
    default:
      return '30 days';
  }
}

export async function getAdoption(period = '30d') {
  const interval = periodInterval(period);
  const [summary] = await sql<Row[]>`
    select
      count(distinct agent_email) filter (where agent_email is not null) as active_agents,
      count(*) filter (where type = 'view') as page_views,
      count(distinct visitor_id) as unique_visitors
    from usage_events where ts >= now() - ${interval}::interval
  `;
  const agents = await sql<Row[]>`
    select a.name, a.tier,
      count(*) filter (where u.type = 'view') as hub_visits,
      max(u.ts) as last_seen
    from agents a
    left join usage_events u on lower(u.agent_email) = lower(a.email) and u.ts >= now() - ${interval}::interval
    group by a.name, a.tier
    order by hub_visits desc
  `;
  const topResources = await sql<Row[]>`
    select label, type as kind, count(*)::int as clicks
    from usage_events
    where type = 'click' and label is not null and ts >= now() - ${interval}::interval
    group by label, type order by clicks desc limit 10
  `;
  const cold = agents.filter((a) => !a.last_seen).map((a) => ({ name: a.name, lastSeen: null }));
  return {
    summary: {
      activeAgents: Number(summary?.active_agents ?? 0),
      pageViews: Number(summary?.page_views ?? 0),
      uniqueVisitors: Number(summary?.unique_visitors ?? 0),
      fubCompliance: 0,
      coldCount: cold.length,
    },
    agents: agents.map((a) => ({
      name: a.name,
      tier: a.tier,
      hubVisits: Number(a.hub_visits ?? 0),
      lastSeen: iso(a.last_seen),
      fubCompliance: 0,
      training: 0,
      marketingHygiene: 0,
      score: Number(a.hub_visits ?? 0),
    })),
    cold,
    topResources: topResources.map((r) => ({ label: r.label, kind: r.kind, clicks: Number(r.clicks) })),
  };
}

export async function getQaLog() {
  const rows = await sql<Row[]>`select kind, title, severity, status, ts from qa_log order by ts desc limit 50`;
  return rows.map((r) => ({ kind: r.kind, title: r.title, severity: r.severity, status: r.status, timestamp: iso(r.ts) }));
}

export async function getRecentFolders() {
  const rows = await sql<Row[]>`
    select name, web_url from drive_folders where kind = 'listing' order by modified_at desc nulls last limit 3
  `;
  return { success: true, folders: rows.map((r) => ({ name: r.name, url: r.web_url })) };
}
