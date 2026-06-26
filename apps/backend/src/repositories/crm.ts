import { sql, j } from '../db/client.js';

type Row = Record<string, unknown>;
const num = (v: unknown): number | null => (v == null ? null : Number(v));
const iso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : v == null ? null : String(v);
const dateOnly = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? null : String(v);

// ── Agent Hub (?agentEmail / ?agentName) ──────────────────────────────────
export async function getAgentHub(opts: { email?: string; name?: string; limit?: number }) {
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 25);
  const contacts = await sql<Row[]>`
    select c.id, c.fub_person_id, c.name, c.email, c.phone
    from contacts c
    left join agents a on a.id = c.assigned_agent_id
    where (${opts.email ?? null}::text is not null and lower(a.email) = lower(${opts.email ?? null}))
       or (${opts.name ?? null}::text is not null and lower(c.assigned_name) = lower(${opts.name ?? null}))
    order by c.last_activity_at desc nulls last
    limit ${limit}
  `;

  let dealCount = 0;
  let todoTotal = 0;
  let doneTotal = 0;
  const out = [];
  for (const c of contacts) {
    const contactId = String(c.id);
    const deals = await sql<Row[]>`
      select fub_deal_id, title, status, stage, price, close_date
      from deals where contact_id = ${contactId}::uuid order by updated_at desc
    `;
    const tasks = await sql<Row[]>`
      select fub_task_id, title, completed, due_date
      from tasks where contact_id = ${contactId}::uuid and is_admin = true order by due_date asc nulls last
    `;
    const done = tasks.filter((t) => t.completed).length;
    const todo = tasks.length - done;
    dealCount += deals.length;
    doneTotal += done;
    todoTotal += todo;
    out.push({
      id: String(c.fub_person_id ?? c.id),
      name: c.name,
      email: c.email,
      phone: c.phone,
      deals: deals.map((d) => ({
        id: d.fub_deal_id,
        title: d.title,
        status: d.status,
        stage: d.stage,
        value: num(d.price),
        closeDate: dateOnly(d.close_date),
      })),
      adminTasks: {
        doneCount: done,
        todoCount: todo,
        tasks: tasks.map((t) => ({
          id: t.fub_task_id,
          title: t.title,
          completed: Boolean(t.completed),
          dueDate: dateOnly(t.due_date),
        })),
      },
    });
  }

  return {
    ok: true,
    meta: {
      generatedAt: new Date().toISOString(),
      contactCount: out.length,
      dealCount,
      todoCount: todoTotal,
      doneCount: doneTotal,
    },
    contacts: out,
    summary: {
      deals: await dealStatusSummary(contacts.map((c) => String(c.id))),
      adminTasks: { doneCount: doneTotal, todoCount: todoTotal },
    },
  };
}

async function dealStatusSummary(contactIds: string[]) {
  if (contactIds.length === 0)
    return { total: 0, open: 0, won: 0, lost: 0, archived: 0, unknown: 0 };
  const rows = await sql<Row[]>`
    select status, count(*)::int n from deals where contact_id = any(${contactIds}::uuid[]) group by status
  `;
  const s = { total: 0, open: 0, won: 0, lost: 0, archived: 0, unknown: 0 };
  for (const r of rows) {
    const n = Number(r.n);
    s.total += n;
    const k = String(r.status) as keyof typeof s;
    if (k in s && k !== 'total') s[k] += n;
    else s.unknown += n;
  }
  return s;
}

// ── Deal Tracker (?view=dealTracker) ──────────────────────────────────────
export async function getDealTracker(opts: { email?: string; name?: string } = {}) {
  const deals = await sql<Row[]>`
    select d.*, c.name as client_name, c.fub_person_id
    from deals d
    left join contacts c on c.id = d.contact_id
    left join agents a on a.id = d.agent_id
    where d.status = 'open'
      and (${opts.email ?? null}::text is null or lower(a.email) = lower(${opts.email ?? null}))
      and (${opts.name ?? null}::text is null or lower(d.agent_name) = lower(${opts.name ?? null}))
    order by d.close_date asc nulls last
  `;

  const result = [];
  let sheetRows = 0;
  for (const d of deals) {
    const dealRowId = String(d.id);
    const personId = d.fub_person_id == null ? null : String(d.fub_person_id);
    const [wf] = await sql<Row[]>`select * from deal_workflow where fub_deal_id = ${String(d.fub_deal_id)}`;
    if (wf) sheetRows++;
    const notes = await sql<Row[]>`
      select fub_note_id, body, author, created_at_fub from notes
      where deal_id = ${dealRowId}::uuid or fub_person_id = ${personId}
      order by created_at_fub desc limit 10
    `;
    const appts = await sql<Row[]>`
      select fub_appt_id, title, starts_at, status from appointments
      where deal_id = ${dealRowId}::uuid or fub_person_id = ${personId} order by starts_at desc limit 10
    `;
    const earnest = (wf?.earnest as Record<string, unknown>) ?? {};
    const extended = (wf?.extended as Record<string, unknown>) ?? {};
    const checklist = (wf?.checklist as Record<string, unknown>) ?? {};
    const overrides = (wf?.date_overrides as Record<string, unknown>) ?? {};
    const dates = (d.dates as Record<string, unknown>) ?? {};
    result.push({
      id: `fub-${d.fub_deal_id}`,
      address: d.address ?? d.title,
      client: d.client_name ?? d.client,
      side: d.side,
      price: num(d.price),
      lender: { name: wf?.lender_name ?? null, company: wf?.lender_company ?? null },
      attorney: { name: wf?.attorney_name ?? null, company: wf?.attorney_company ?? null },
      agent: d.agent_name,
      stage: d.stage,
      dates: {
        contract: dateOnly(dates.contract),
        inspection: dateOnly(overrides.inspection ?? dates.inspection),
        attorney: dateOnly(overrides.attorney ?? dates.attorney),
        appraisal: dateOnly(overrides.appraisal ?? dates.appraisal),
        mortgageCommitment: dateOnly(overrides.mortgageCommitment ?? dates.mortgageCommitment),
        closing: dateOnly(d.close_date),
      },
      extended: { attorney: Boolean(extended.attorney), mortgageCommitment: Boolean(extended.mortgageCommitment) },
      earnest: {
        initial: earnest.initial ?? { amount: null, sent: false, receipt: false, toClient: false, toLender: false },
        balance: earnest.balance ?? { amount: null, sent: false, receipt: false, toClient: false, toLender: false },
      },
      checklist: {
        inspectionScheduled: Boolean(checklist.inspectionScheduled),
        inspectionDone: Boolean(checklist.inspectionDone),
        appraisalDone: Boolean(checklist.appraisalDone),
        mortgageCommitment: Boolean(checklist.mortgageCommitment),
        finalWalkScheduled: Boolean(checklist.finalWalkScheduled),
        finalWalkDone: Boolean(checklist.finalWalkDone),
        closingStatement: Boolean(checklist.closingStatement),
        reviewSent: Boolean(checklist.reviewSent),
        commissionStatement: Boolean(checklist.commissionStatement),
        socialPost: Boolean(checklist.socialPost),
        followUp3wk: Boolean(checklist.followUp3wk),
      },
      fub: {
        personId: d.fub_person_id,
        dealId: d.fub_deal_id,
        dealUrl: d.deal_url,
        personUrl: d.person_url,
        notes: notes.map((n) => ({ id: n.fub_note_id, body: n.body, author: n.author, createdAt: iso(n.created_at_fub) })),
        appointments: appts.map((a) => ({ id: a.fub_appt_id, title: a.title, startsAt: iso(a.starts_at), status: a.status })),
        tags: (d.tags as string[]) ?? [],
      },
    });
  }

  return {
    ok: true,
    meta: { generatedAt: new Date().toISOString(), dealCount: result.length, cached: false, sheetRowsLoaded: sheetRows },
    deals: result,
  };
}

// ── upsert a deal workflow row (UI writeback replaces the Sheet) ──────────
export async function upsertDealWorkflow(fubDealId: string, body: Record<string, unknown>) {
  const id = fubDealId.replace(/^fub-/, '');
  const lender = (body.lender as Row) ?? {};
  const attorney = (body.attorney as Row) ?? {};
  const str = (v: unknown): string | null => (v == null ? null : String(v));
  await sql`
    insert into deal_workflow (fub_deal_id, lender_name, lender_company, attorney_name, attorney_company,
                               earnest, extended, checklist, date_overrides, raw)
    values (${id}, ${str(lender.name)}, ${str(lender.company)},
            ${str(attorney.name)}, ${str(attorney.company)},
            ${j(body.earnest ?? {})}, ${j(body.extended ?? {})},
            ${j(body.checklist ?? {})}, ${j(body.dates ?? {})},
            ${j(body)})
    on conflict (fub_deal_id) do update set
      lender_name = excluded.lender_name, lender_company = excluded.lender_company,
      attorney_name = excluded.attorney_name, attorney_company = excluded.attorney_company,
      earnest = excluded.earnest, extended = excluded.extended, checklist = excluded.checklist,
      date_overrides = excluded.date_overrides, raw = excluded.raw, updated_at = now()
  `;
  return { ok: true, dealId: id };
}

// ── Schema (?view=schema) ─────────────────────────────────────────────────
export async function getFubSchema() {
  const [row] = await sql<Row[]>`select payload from external_cache where key = 'fub:schema'`;
  return {
    ok: true,
    meta: { generatedAt: new Date().toISOString() },
    schema: row?.payload ?? { customFields: [], stages: [], pipelines: [] },
  };
}
