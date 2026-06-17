import { sql, j } from '../db/client.js';
import { env } from '../env.js';
import { fubClient } from '../connectors/fub.js';
import { log } from '../logger.js';

type Rec = Record<string, unknown>;

export interface IntakeResult {
  success: boolean;
  leadId?: string;
  listingId?: string;
  personId?: unknown;
  noteId?: unknown;
  dealId?: unknown;
  assignedTo?: { id?: unknown; name?: unknown; email?: unknown };
  preview?: boolean;
  error?: string;
}

export function isSpam(body: Rec): boolean {
  if (typeof body.company === 'string' && body.company.trim() !== '') return true;
  const renderMs = Number(body._renderMs);
  if (Number.isFinite(renderMs) && renderMs < 4000) return true;
  return false;
}

/** Persist a buyer/seller onboarding submission, then mirror to FUB. */
export async function handleIntake(body: Rec, ip?: string): Promise<IntakeResult> {
  if (isSpam(body)) return { success: false, error: 'rejected' };

  const formType = String(body._formType ?? 'buyer-onboarding');
  const contact = (body.contact as Rec) ?? {};
  const agent = (body.agent as Rec) ?? {};
  const marketing = (body.marketing as Rec) ?? {};
  const agentEmail = String(agent.email ?? '').toLowerCase() || null;
  const name = String(contact.name ?? '').trim() || null;
  const email = String(contact.email ?? '').trim() || null;
  const phone = String(contact.phone ?? '').trim() || null;

  const [agentRow] = agentEmail
    ? await sql<{ id: string }[]>`select id from agents where lower(email) = ${agentEmail} limit 1`
    : [];

  const [lead] = await sql<{ id: string }[]>`
    insert into leads (form_type, page, submitted_at, render_ms, name, email, phone,
                       contact_methods, how_heard, marketing, agent_id, agent_name, agent_email,
                       match_me, payload, ip, status)
    values (${formType}, ${String(body._page ?? '')}, ${(body._submittedAt as string) ?? null},
            ${Number(body._renderMs) || null}, ${name}, ${email}, ${phone},
            ${(contact.methods as string[]) ?? []}, ${String(body.howHeard ?? '') || null},
            ${j(marketing)}, ${agentRow?.id ?? null}, ${String(agent.name ?? '') || null},
            ${agentEmail}, ${Boolean(agent.matchMe)}, ${j(body)}, ${ip ?? null}, 'new')
    returning id
  `;
  const leadId = lead!.id;

  // A seller onboarding is the trigger for a new listing: create a Pre-Listing
  // draft so it shows up in the console workshop immediately. Best-effort — a
  // failure here must not block the lead/FUB flow.
  let listingId: string | undefined;
  let existingDealId: string | null = null;
  if (formType === 'seller-onboarding') {
    try {
      const res = await createListingFromSellerIntake(body, {
        leadId,
        agentId: agentRow?.id ?? null,
        agentName: String(agent.name ?? '') || null,
        sellerName: name,
        sellerEmail: email,
        sellerPhone: phone,
      });
      listingId = res?.listingId;
      existingDealId = res?.fubDealId ?? null;
    } catch (err) {
      log.warn(`lead ${leadId} listing draft failed: ${String(err)}`);
    }
  }

  const fub = fubClient();
  if (!fub) {
    log.info(`lead ${leadId} stored (FUB not configured — preview mode)`);
    return { success: true, leadId, listingId, preview: true };
  }

  try {
    const result = await pushLeadToFub(fub, body, formType, { name, email, phone, agentEmail }, { existingDealId });
    await sql`
      update leads set fub_person_id = ${String(result.personId ?? '')},
        fub_note_id = ${result.noteId != null ? String(result.noteId) : null},
        fub_synced = true, status = 'synced', updated_at = now()
      where id = ${leadId}
    `;
    // Tie the FUB deal back to the Pre-Listing so the workshop and FUB stay linked.
    if (listingId && result.dealId != null) {
      try {
        await sql`update listings set fub_deal_id = ${String(result.dealId)}, updated_at = now() where id = ${listingId}`;
      } catch (err) {
        log.warn(`lead ${leadId} listing/deal link failed: ${String(err)}`);
      }
    }
    return { success: true, leadId, listingId, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sql`update leads set status = 'error', error = ${message}, updated_at = now() where id = ${leadId}`;
    log.error(`lead ${leadId} FUB sync failed: ${message}`);
    return { success: false, leadId, listingId, error: message };
  }
}

/**
 * Create (or refresh) the Pre-Listing draft for a seller onboarding. Keyed by
 * the listing's normalized address so a re-submission updates in place. The full
 * questionnaire is stored on the listing for the workshop, and a milestone is
 * written to the activity timeline.
 */
async function createListingFromSellerIntake(
  body: Rec,
  who: {
    leadId: string;
    agentId: string | null;
    agentName: string | null;
    sellerName: string | null;
    sellerEmail: string | null;
    sellerPhone: string | null;
  },
): Promise<{ listingId: string; fubDealId: string | null } | undefined> {
  const property = (body.property as Rec) ?? {};
  const address = String(property.address ?? '').trim();
  if (!address) return undefined;
  const questionnaire = formatQuestionnaire(body);

  const [row] = await sql<{ id: string; inserted: boolean; fub_deal_id: string | null }[]>`
    insert into listings (
      address, status, phase_key, listing_type, source,
      agent_id, agent_name, seller_name, seller_email, seller_phone,
      seller_questionnaire_content, seller_questionnaire_sent, seller_questionnaire_sent_at, lead_id
    ) values (
      ${address}, 'Pre Listing', 'prelisting', 'Sale', 'onboarding',
      ${who.agentId}, ${who.agentName}, ${who.sellerName}, ${who.sellerEmail}, ${who.sellerPhone},
      ${questionnaire}, true, now(), ${who.leadId}
    )
    on conflict (address_normalized) do update set
      agent_id = coalesce(excluded.agent_id, listings.agent_id),
      agent_name = coalesce(excluded.agent_name, listings.agent_name),
      seller_name = coalesce(excluded.seller_name, listings.seller_name),
      seller_email = coalesce(excluded.seller_email, listings.seller_email),
      seller_phone = coalesce(excluded.seller_phone, listings.seller_phone),
      seller_questionnaire_content = excluded.seller_questionnaire_content,
      seller_questionnaire_sent = true,
      seller_questionnaire_sent_at = now(),
      lead_id = coalesce(listings.lead_id, excluded.lead_id),
      updated_at = now()
    returning id, (xmax = 0) as inserted, fub_deal_id
  `;
  const listingId = String(row!.id);
  const propertyType = String(property.type ?? '').trim();
  await sql`
    insert into listing_activity (listing_id, type, label, actor, meta, client_visible)
    values (
      ${listingId},
      ${row!.inserted ? 'listing_created' : 'status_changed'},
      ${row!.inserted ? 'New seller onboarding received' : 'Seller onboarding updated'},
      ${who.agentName ?? who.sellerName ?? 'Seller onboarding'},
      ${j({ source: 'seller-onboarding', propertyType, leadId: who.leadId })},
      true
    )
  `;
  return { listingId, fubDealId: row!.fub_deal_id ?? null };
}

async function pushLeadToFub(
  fub: NonNullable<ReturnType<typeof fubClient>>,
  body: Rec,
  formType: string,
  who: { name: string | null; email: string | null; phone: string | null; agentEmail: string | null },
  opts: { existingDealId?: string | null } = {},
) {
  const isSeller = formType === 'seller-onboarding';
  const fallbackEmail = isSeller ? env.SELLER_INTAKE_FALLBACK_EMAIL : env.BUYER_INTAKE_FALLBACK_EMAIL;
  const source = isSeller ? env.SELLER_INTAKE_SOURCE : env.BUYER_INTAKE_SOURCE;
  const system = isSeller ? env.SELLER_INTAKE_SYSTEM : env.BUYER_INTAKE_SYSTEM;
  const baseTag = isSeller ? 'Seller Onboarding' : 'Buyer Onboarding';

  const agent = (body.agent as Rec) ?? {};
  const matchMe = Boolean(agent.matchMe);
  const targetEmail = matchMe ? fallbackEmail : who.agentEmail || fallbackEmail;

  let assignedUser: Rec | null = null;
  if (targetEmail) assignedUser = await fub.findUserByEmail(targetEmail);

  const marketing = (body.marketing as Rec) ?? {};
  const tags = [baseTag];
  if (marketing.generalOptIn === false) tags.push('Marketing Opt-Out');
  if (marketing.searchOptIn === false) tags.push(isSeller ? 'Market Updates Opt-Out' : 'Search Emails Opt-Out');

  // Dedupe: if this seller is already a contact (match email, then phone, then
  // exact full name — any one is enough), attach to that record instead of
  // creating a duplicate. We preserve their current owner and only merge tags.
  const existing = (who.email || who.phone || who.name)
    ? await fub.findExistingPerson({ email: who.email, phone: who.phone, name: who.name })
    : null;

  let personId: unknown;
  if (existing?.id != null) {
    personId = existing.id;
    const current = Array.isArray(existing.tags) ? (existing.tags as string[]) : [];
    const mergedTags = Array.from(new Set([...current, ...tags]));
    try {
      await fub.updatePerson(personId as string | number, { tags: mergedTags });
    } catch (err) {
      log.warn(`tag merge failed for person ${String(personId)}: ${String(err)}`);
    }
  } else {
    const person: Rec = {
      name: who.name,
      emails: who.email ? [{ value: who.email }] : [],
      phones: who.phone ? [{ value: who.phone }] : [],
      tags,
    };
    if (assignedUser?.id != null) person.assignedUserId = assignedUser.id;

    const event = await fub.createEvent({ source, system, type: 'Registration', person });
    personId = (event.person as Rec | undefined)?.id ?? (event as Rec).id;

    if (personId != null && assignedUser?.id != null) {
      try {
        await fub.updatePerson(personId as string | number, { assignedUserId: assignedUser.id });
      } catch (err) {
        log.warn(`reassign failed for person ${String(personId)}: ${String(err)}`);
      }
    }
  }

  let noteId: unknown = null;
  if (personId != null) {
    const note = await fub.createNote({ personId, subject: baseTag, body: formatQuestionnaire(body) });
    noteId = note.id;
  }

  // A seller onboarding is the start of a sale: open (or update) a deal in the
  // Sellers pipeline. If the Pre-Listing already has a deal id (re-submission),
  // we update it instead of creating a duplicate. The deal is owned by the
  // contact's current owner so the right agent sees it. Best-effort.
  let dealId: unknown = opts.existingDealId ?? null;
  if (isSeller && env.FUB_CREATE_SELLER_DEAL && personId != null) {
    try {
      const property = (body.property as Rec) ?? {};
      const address = String(property.address ?? '').trim();
      const dealName = address || `${who.name ?? 'Seller'} — Listing`;
      const price = parsePrice(property.price ?? property.estimatedValue ?? property.listPrice);
      const ownerId = (existing?.assignedUserId as unknown) ?? assignedUser?.id ?? null;
      if (opts.existingDealId) {
        const update: Rec = { name: dealName };
        if (price != null) update.price = price;
        await fub.updateDeal(opts.existingDealId, update);
        dealId = opts.existingDealId;
      } else {
        const deal: Rec = {
          name: dealName,
          stageId: env.FUB_SELLER_DEAL_STAGE_ID,
          peopleIds: [personId],
        };
        if (ownerId != null) deal.userIds = [ownerId];
        if (price != null) deal.price = price;
        const created = await fub.createDeal(deal);
        dealId = (created as Rec).id ?? null;
      }
    } catch (err) {
      log.warn(`seller deal upsert failed for person ${String(personId)}: ${String(err)}`);
    }
  }

  return {
    personId,
    noteId,
    dealId,
    assignedTo: assignedUser
      ? { id: assignedUser.id, name: assignedUser.name, email: assignedUser.email }
      : existing?.assignedUserId != null
        ? { id: existing.assignedUserId }
        : undefined,
  };
}

/** Coerce a loose price value (e.g. "$1,250,000") into an integer dollar amount. */
function parsePrice(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Render the full questionnaire payload as a readable FUB note body. */
function formatQuestionnaire(body: Rec): string {
  const lines: string[] = [];
  const skip = new Set(['company', '_formType', '_page', '_submittedAt', '_renderMs', 'contact', 'agent']);
  const walk = (obj: Rec, prefix = '') => {
    for (const [k, v] of Object.entries(obj)) {
      if (skip.has(k)) continue;
      const label = prefix ? `${prefix} › ${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v as Rec, label);
      else if (Array.isArray(v)) lines.push(`${label}: ${v.join(', ')}`);
      else if (v != null && v !== '') lines.push(`${label}: ${String(v)}`);
    }
  };
  walk(body);
  return lines.join('\n');
}
