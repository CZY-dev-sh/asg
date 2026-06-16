import { sql } from '../db/client.js';
import { handleIntake } from './intake.js';

type Row = Record<string, unknown>;
const num = (v: unknown): number | null => (v == null ? null : Number(v));
const dateOnly = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? null : String(v);
const iso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : v == null ? null : String(v);

// Client-facing milestone order built from the deal workflow checklist + dates.
const MILESTONES: Array<{ key: string; label: string; checklist?: string; dateKey?: string }> = [
  { key: 'contract', label: 'Under Contract', dateKey: 'contract' },
  { key: 'inspection', label: 'Inspection', checklist: 'inspectionDone', dateKey: 'inspection' },
  { key: 'attorney', label: 'Attorney Review', dateKey: 'attorney' },
  { key: 'appraisal', label: 'Appraisal', checklist: 'appraisalDone', dateKey: 'appraisal' },
  { key: 'mortgage', label: 'Mortgage Commitment', checklist: 'mortgageCommitment', dateKey: 'mortgageCommitment' },
  { key: 'finalWalk', label: 'Final Walkthrough', checklist: 'finalWalkDone' },
  { key: 'closing', label: 'Closing', dateKey: 'closing' },
];

/** A client's deals with progress, safe for the buyer/seller portal. */
export async function getClientDeals(contactId: string) {
  const deals = await sql<Row[]>`
    select d.*, c.name as client_name from deals d
    left join contacts c on c.id = d.contact_id
    where d.contact_id = ${contactId}::uuid
    order by case when d.status = 'open' then 0 else 1 end, d.close_date asc nulls last
  `;

  const out = [];
  for (const d of deals) {
    const [wf] = await sql<Row[]>`select * from deal_workflow where fub_deal_id = ${String(d.fub_deal_id)}`;
    const checklist = (wf?.checklist as Record<string, unknown>) ?? {};
    const overrides = (wf?.date_overrides as Record<string, unknown>) ?? {};
    const dates = (d.dates as Record<string, unknown>) ?? {};
    const extended = (wf?.extended as Record<string, unknown>) ?? {};

    const milestones = MILESTONES.map((m) => {
      const date =
        m.dateKey === 'closing'
          ? dateOnly(d.close_date)
          : m.dateKey
            ? dateOnly(overrides[m.dateKey] ?? dates[m.dateKey])
            : null;
      const done = m.checklist ? Boolean(checklist[m.checklist]) : false;
      return { key: m.key, label: m.label, date, done, extended: Boolean(extended[m.key]) };
    });

    const checklistKeys = MILESTONES.filter((m) => m.checklist).map((m) => m.checklist!);
    const completed = checklistKeys.filter((k) => Boolean(checklist[k])).length;
    const progress = d.status === 'won' ? 100 : Math.round((completed / checklistKeys.length) * 100);

    // Client-visible appointments (showings, inspections) — no internal notes/tasks.
    const appts = await sql<Row[]>`
      select title, starts_at, status from appointments
      where contact_id = ${contactId}::uuid order by starts_at desc limit 10
    `;

    out.push({
      id: `fub-${d.fub_deal_id}`,
      address: d.address ?? d.title,
      status: d.status,
      stage: d.stage,
      side: d.side,
      price: num(d.price),
      agent: d.agent_name,
      closeDate: dateOnly(d.close_date),
      progress,
      milestones,
      appointments: appts.map((a) => ({ title: a.title, startsAt: iso(a.starts_at), status: a.status })),
    });
  }
  return out;
}

// ── onboarding drafts ─────────────────────────────────────────────────────
export async function getDraft(userId: string, formType: string) {
  const [row] = await sql<Row[]>`
    select form_type, step, data, completed, lead_id, updated_at
    from onboarding_drafts where user_id = ${userId} and form_type = ${formType} limit 1
  `;
  if (!row) return null;
  return {
    formType: row.form_type,
    step: Number(row.step ?? 0),
    data: row.data ?? {},
    completed: Boolean(row.completed),
    leadId: row.lead_id ?? null,
    updatedAt: iso(row.updated_at),
  };
}

export async function saveDraft(
  userId: string,
  formType: string,
  step: number,
  data: Record<string, unknown>,
) {
  await sql`
    insert into onboarding_drafts (user_id, form_type, step, data)
    values (${userId}, ${formType}, ${step}, ${sql.json(data as Parameters<typeof sql.json>[0])})
    on conflict (user_id, form_type) do update set
      step = excluded.step, data = excluded.data, updated_at = now()
  `;
  return { ok: true };
}

/** Finalize a saved draft: create the FUB lead, then mark the draft completed. */
export async function submitDraft(
  userId: string,
  formType: string,
  extra: Record<string, unknown> = {},
) {
  const draft = await getDraft(userId, formType);
  if (!draft) return { success: false, error: 'no draft to submit' };
  const payload: Record<string, unknown> = {
    ...(draft.data as Record<string, unknown>),
    ...extra,
    _formType: formType,
  };
  // bypass the time-trap: an authenticated, deliberate submit is trusted
  if (payload._renderMs == null) payload._renderMs = 60_000;
  const result = await handleIntake(payload);
  await sql`
    update onboarding_drafts set completed = ${result.success},
      lead_id = ${result.leadId ?? null}, updated_at = now()
    where user_id = ${userId} and form_type = ${formType}
  `;
  if (result.leadId) {
    await sql`update leads set user_id = ${userId} where id = ${result.leadId}`;
  }
  return result;
}
