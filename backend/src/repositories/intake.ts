import { sql, j } from '../db/client.js';
import { env } from '../env.js';
import { fubClient } from '../connectors/fub.js';
import { log } from '../logger.js';

type Rec = Record<string, unknown>;

export interface IntakeResult {
  success: boolean;
  leadId?: string;
  personId?: unknown;
  noteId?: unknown;
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

  const fub = fubClient();
  if (!fub) {
    log.info(`lead ${leadId} stored (FUB not configured — preview mode)`);
    return { success: true, leadId, preview: true };
  }

  try {
    const result = await pushLeadToFub(fub, body, formType, { name, email, phone, agentEmail });
    await sql`
      update leads set fub_person_id = ${String(result.personId ?? '')},
        fub_note_id = ${result.noteId != null ? String(result.noteId) : null},
        fub_synced = true, status = 'synced', updated_at = now()
      where id = ${leadId}
    `;
    return { success: true, leadId, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sql`update leads set status = 'error', error = ${message}, updated_at = now() where id = ${leadId}`;
    log.error(`lead ${leadId} FUB sync failed: ${message}`);
    return { success: false, leadId, error: message };
  }
}

async function pushLeadToFub(
  fub: NonNullable<ReturnType<typeof fubClient>>,
  body: Rec,
  formType: string,
  who: { name: string | null; email: string | null; phone: string | null; agentEmail: string | null },
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

  const person: Rec = {
    name: who.name,
    emails: who.email ? [{ value: who.email }] : [],
    phones: who.phone ? [{ value: who.phone }] : [],
    tags,
  };
  if (assignedUser?.id != null) person.assignedUserId = assignedUser.id;

  const event = await fub.createEvent({ source, system, type: 'Registration', person });
  const personId = (event.person as Rec | undefined)?.id ?? (event as Rec).id;

  if (personId != null && assignedUser?.id != null) {
    try {
      await fub.updatePerson(personId as string | number, { assignedUserId: assignedUser.id });
    } catch (err) {
      log.warn(`reassign failed for person ${String(personId)}: ${String(err)}`);
    }
  }

  let noteId: unknown = null;
  if (personId != null) {
    const note = await fub.createNote({ personId, subject: baseTag, body: formatQuestionnaire(body) });
    noteId = note.id;
  }

  return {
    personId,
    noteId,
    assignedTo: assignedUser
      ? { id: assignedUser.id, name: assignedUser.name, email: assignedUser.email }
      : undefined,
  };
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
