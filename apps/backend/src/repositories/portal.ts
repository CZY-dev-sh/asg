import { sql } from '../db/client.js';
import { handleIntake } from './intake.js';
import type { Profile } from '../auth.js';

type Row = Record<string, unknown>;
const num = (v: unknown): number | null => (v == null ? null : Number(v));
const dateOnly = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? null : String(v);
const iso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : v == null ? null : String(v);

const CLIENT_ACTIONS: Record<string, Array<{ key: string; label: string; description: string; href?: string }>> = {
  buyer: [
    { key: 'buyer-intake', label: 'Complete your buyer profile', description: 'Tell us about budget, timing, neighborhoods and must-haves.' },
    { key: 'preapproval', label: 'Upload or share pre-approval', description: 'Keep financing ready before showings and offers.' },
    { key: 'showings', label: 'Track upcoming showings', description: 'Your agent can keep important dates visible here.' },
  ],
  seller: [
    { key: 'seller-intake', label: 'Complete your seller profile', description: 'Share property details so we can prepare your launch.' },
    { key: 'media', label: 'Follow marketing progress', description: 'Photo shoots, assets and launch tasks appear as they are completed.' },
    { key: 'listing-live', label: 'Watch listing milestones', description: 'From pre-listing to MLS launch and contract milestones.' },
  ],
  renter: [
    { key: 'renter-profile', label: 'Build your rental profile', description: 'Share budget, move-in timing, pets and desired neighborhoods.' },
    { key: 'documents', label: 'Prepare application items', description: 'Keep IDs, proof of income and references organized.' },
    { key: 'tour-plan', label: 'Track tours and applications', description: 'Tour notes and application status can live here as we connect rental data.' },
  ],
  undecided: [
    { key: 'choose-path', label: 'Choose your portal path', description: 'Pick buyer, seller or renter so we can personalize your dashboard.' },
  ],
};

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

async function getDrafts(userId: string) {
  const rows = await sql<Row[]>`
    select form_type, step, completed, lead_id, updated_at
    from onboarding_drafts
    where user_id = ${userId}::uuid
    order by updated_at desc
  `;
  return rows.map((r) => ({
    formType: r.form_type,
    step: Number(r.step ?? 0),
    completed: Boolean(r.completed),
    leadId: r.lead_id ?? null,
    updatedAt: iso(r.updated_at),
  }));
}

async function getSellerListings(profile: Profile) {
  const rows = await sql<Row[]>`
    select l.id, l.address, l.status, l.phase_key, l.marketing_status,
           l.photos_status, l.cover_image_url, l.list_price,
           l.photos_datetime, l.photos_delivered_at, l.shared_with_agent_at,
           l.idx_listing_id
    from listings l
    left join leads le on le.id = l.lead_id
    where (${profile.id}::uuid is not null and le.user_id = ${profile.id}::uuid)
       or (${profile.email ?? null}::text is not null and lower(l.seller_email) = lower(${profile.email ?? null}))
       or (${profile.phone ?? null}::text is not null and regexp_replace(coalesce(l.seller_phone,''), '\\D', '', 'g') =
          regexp_replace(${profile.phone ?? ''}, '\\D', '', 'g'))
    order by l.updated_at desc nulls last
    limit 8
  `;
  return rows.map((r) => ({
    id: r.id,
    address: r.address,
    status: r.status,
    phaseKey: r.phase_key,
    marketingStatus: r.marketing_status,
    photosStatus: r.photos_status,
    coverImageUrl: r.cover_image_url,
    listPrice: num(r.list_price),
    photosAt: iso(r.photos_datetime),
    photosDeliveredAt: iso(r.photos_delivered_at),
    sharedWithAgentAt: iso(r.shared_with_agent_at),
    idxListingId: r.idx_listing_id ?? null,
  }));
}

async function getSellerActivity(profile: Profile) {
  const rows = await sql<Row[]>`
    select la.id, la.ts, la.type, la.label, la.actor, la.meta
    from listing_activity la
    join listings l on l.id = la.listing_id
    left join leads le on le.id = l.lead_id
    where la.client_visible = true
      and (
        le.user_id = ${profile.id}::uuid
        or (${profile.email ?? null}::text is not null and lower(l.seller_email) = lower(${profile.email ?? null}))
        or (${profile.phone ?? null}::text is not null and regexp_replace(coalesce(l.seller_phone,''), '\\D', '', 'g') =
          regexp_replace(${profile.phone ?? ''}, '\\D', '', 'g'))
      )
    order by la.ts desc
    limit 20
  `;
  return rows.map((r) => ({
    id: r.id,
    ts: iso(r.ts),
    type: r.type,
    label: r.label,
    actor: r.actor,
    meta: r.meta ?? {},
  }));
}

async function getSellerDocuments(listingIds: string[]) {
  if (!listingIds.length) return [];
  const rows = await sql<Row[]>`
    select id, listing_id, title, category, file_url, storage_path, uploaded_by, created_at
    from listing_documents
    where client_visible = true and listing_id = any(${listingIds}::uuid[])
    order by created_at desc
    limit 50
  `;
  return rows.map((r) => ({
    id: r.id,
    listingId: r.listing_id,
    title: r.title,
    category: r.category,
    url: r.file_url,
    storagePath: r.storage_path,
    uploadedBy: r.uploaded_by,
    createdAt: iso(r.created_at),
  }));
}

async function getOpenHouseMetrics(listingIds: string[]) {
  if (!listingIds.length) return { openHouses: 0, leads: 0, upcoming: [] };
  const [counts] = await sql<Row[]>`
    select
      (select count(*) from open_houses where listing_id = any(${listingIds}::uuid[])) as open_houses,
      (select count(*) from open_house_leads where listing_id = any(${listingIds}::uuid[])) as leads
  `;
  const upcoming = await sql<Row[]>`
    select id, listing_id, starts_at, ends_at
    from open_houses
    where listing_id = any(${listingIds}::uuid[])
      and starts_at >= now() - interval '1 day'
    order by starts_at asc
    limit 8
  `;
  return {
    openHouses: Number(counts?.open_houses ?? 0),
    leads: Number(counts?.leads ?? 0),
    upcoming: upcoming.map((r) => ({
      id: r.id,
      listingId: r.listing_id,
      startsAt: iso(r.starts_at),
      endsAt: iso(r.ends_at),
    })),
  };
}

function sellerActionPlan(listings: Array<Record<string, unknown>>) {
  const primary = listings[0] ?? {};
  const photosDone = Boolean(primary.photosDeliveredAt);
  const photosScheduled = Boolean(primary.photosAt);
  const mlsLinked = Boolean(primary.idxListingId);
  return {
    asg: [
      { key: 'prep', label: 'Review listing details', status: 'in_progress', description: 'ASG is organizing property details, pricing notes and launch requirements.' },
      { key: 'media', label: 'Schedule and complete media', status: photosDone ? 'done' : photosScheduled ? 'in_progress' : 'todo', description: photosDone ? 'Photos have been delivered.' : photosScheduled ? 'Media is scheduled.' : 'Media scheduling will appear here once booked.' },
      { key: 'launch', label: 'Prepare MLS launch', status: mlsLinked ? 'done' : 'todo', description: mlsLinked ? 'The listing is linked to the MLS feed.' : 'MLS launch progress will appear when the listing goes live.' },
      { key: 'interest', label: 'Track buyer interest', status: mlsLinked ? 'in_progress' : 'todo', description: 'Open house leads and buyer activity will populate after launch.' },
    ],
    client: [
      { key: 'access', label: 'Confirm property access', status: photosScheduled ? 'done' : 'todo', description: 'Make sure keys, lockbox, parking, elevators and pets are handled before media.' },
      { key: 'prep-home', label: 'Prepare the home for photos', status: photosDone ? 'done' : 'todo', description: 'Declutter, clean surfaces, turn on lights and hide personal items before the shoot.' },
      { key: 'docs', label: 'Review uploaded documents', status: 'todo', description: 'Contracts, disclosures and listing documents will live in your portal.' },
    ],
  };
}

export async function getPortalHome(userId: string, profile: Profile) {
  const clientType = profile.clientType ?? 'undecided';
  const deals = profile.contactId ? await getClientDeals(profile.contactId) : [];
  const drafts = await getDrafts(userId);
  const sellerListings = clientType === 'seller' || clientType === 'undecided' ? await getSellerListings(profile) : [];
  const sellerActivity =
    clientType === 'seller' || sellerListings.length ? await getSellerActivity(profile) : [];
  const sellerListingIds = sellerListings.map((l) => String(l.id)).filter(Boolean);
  const [sellerDocuments, openHouseMetrics] = await Promise.all([
    getSellerDocuments(sellerListingIds),
    getOpenHouseMetrics(sellerListingIds),
  ]);

  return {
    ok: true,
    profile: {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      phone: profile.phone,
      role: profile.role,
      clientType,
      portalOnboardingCompleted: profile.portalOnboardingCompleted,
      portalPreferences: profile.portalPreferences,
    },
    recommendedActions: CLIENT_ACTIONS[clientType] ?? CLIENT_ACTIONS.undecided,
    deals,
    drafts,
    seller: {
      listings: sellerListings,
      activity: sellerActivity,
      documents: sellerDocuments,
      actionPlan: sellerActionPlan(sellerListings as Array<Record<string, unknown>>),
      metrics: openHouseMetrics,
    },
    renter: {
      applications: [],
      tours: [],
      note: 'Rental tour and application status will appear here once rental workflow data is connected.',
    },
  };
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
