import { sql } from '../db/client.js';

type Row = Record<string, unknown>;
const iso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : v == null ? null : String(v);

export async function getDirectory() {
  const rows = await sql<Row[]>`
    select slug, name, email, phone, fub_phone, tier, role, dept, hours,
           headshot_url, bio, seniority_rank, drive_folder_id, quick_links, active
    from agents where active = true
    order by case tier when 'admin' then 0 else 1 end, seniority_rank asc, name asc
  `;
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    email: r.email,
    phone: r.phone,
    fubPhone: r.fub_phone,
    tier: r.tier,
    role: r.role,
    dept: r.dept,
    hours: r.hours,
    headshot: r.headshot_url,
    bio: r.bio,
    seniorityRank: r.seniority_rank,
    driveFolderId: r.drive_folder_id,
    quickLinks: r.quick_links ?? [],
  }));
}

export async function getEvents() {
  const rows = await sql<Row[]>`
    select id, title, starts_at, ends_at, all_day, location, description, audience, url
    from team_events where ends_at is null or ends_at >= now() - interval '1 day'
    order by starts_at asc nulls last
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    startsAt: iso(r.starts_at),
    endsAt: iso(r.ends_at),
    allDay: Boolean(r.all_day),
    location: r.location,
    description: r.description,
    audience: r.audience,
    url: r.url,
  }));
}

export async function getUpdates() {
  const rows = await sql<Row[]>`
    select id, title, body, published_at, audience, pinned, author
    from team_updates order by pinned desc, published_at desc limit 50
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    publishedAt: iso(r.published_at),
    audience: r.audience,
    pinned: Boolean(r.pinned),
    author: r.author,
  }));
}

export async function getLanding(slug: string, page = 'general') {
  const [row] = await sql<Row[]>`
    select lp.*, a.name as agent_name, a.email as agent_email, a.phone as agent_phone, a.headshot_url
    from landing_pages lp
    left join agents a on a.id = lp.agent_id
    where lp.slug = ${slug} and lp.page_type = ${page}
    limit 1
  `;
  if (!row) return null;
  return {
    slug: row.slug,
    pageType: row.page_type,
    agent: { name: row.agent_name, email: row.agent_email, phone: row.agent_phone, headshot: row.headshot_url },
    hero: row.hero ?? {},
    sections: row.sections ?? [],
    stats: row.stats ?? {},
    reviews: row.reviews ?? [],
    idxConfig: row.idx_config ?? {},
    curatedListings: row.curated_listings ?? [],
  };
}

export async function getHubData(view: string, params: { slug?: string; page?: string }) {
  switch (view) {
    case 'directory':
      return { ok: true, directory: await getDirectory() };
    case 'events':
      return { ok: true, events: await getEvents() };
    case 'updates':
      return { ok: true, updates: await getUpdates() };
    case 'landing':
      return { ok: true, landing: params.slug ? await getLanding(params.slug, params.page) : null };
    case 'all':
    default:
      return {
        ok: true,
        directory: await getDirectory(),
        events: await getEvents(),
        updates: await getUpdates(),
      };
  }
}
