import { sql } from '../db/client.js';
import { supabase } from '../storage.js';
import { env } from '../env.js';
import { log } from '../logger.js';
import { ApiError } from './admin.js';

type Row = Record<string, unknown>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invite someone to become an admin. The invite row is what actually grants
 * `role = 'admin'` (via handle_new_user(), see 0020_admin_invites.sql) — not
 * domain or roster membership, since new admin hires aren't necessarily
 * agents. Sends Supabase's own invite email (magic link → set password),
 * so no separate email service is needed.
 *
 * If the person already has an account (any role), Supabase can't "invite"
 * them again — instead we promote their existing profile directly, since
 * that's what the admin actually wants in that case.
 */
export async function createInvite(
  invitedByUserId: string | null,
  email: string,
  fullName?: string,
): Promise<{ status: 'invited' | 'promoted'; email: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail)) throw new ApiError(400, 'a valid email is required');
  const cleanName = fullName?.trim() || null;

  await sql`
    insert into admin_invites (email, full_name, invited_by, status, created_at, expires_at, claimed_at)
    values (${cleanEmail}, ${cleanName}, ${invitedByUserId}::uuid, 'pending', now(), now() + interval '14 days', null)
    on conflict (email) do update set
      full_name = coalesce(excluded.full_name, admin_invites.full_name),
      invited_by = excluded.invited_by,
      status = 'pending',
      created_at = now(),
      expires_at = now() + interval '14 days',
      claimed_at = null
  `;

  const { error } = await supabase().auth.admin.inviteUserByEmail(cleanEmail, {
    data: cleanName ? { full_name: cleanName } : undefined,
    redirectTo: env.ADMIN_CONSOLE_URL,
  });

  if (!error) return { status: 'invited', email: cleanEmail };

  // Already registered (any role) — promote directly instead of erroring out;
  // this is exactly what an admin means by "invite" in that case.
  if (/already.*registered|already.*exists/i.test(error.message)) {
    const rows = await sql<Row[]>`
      update profiles set role = 'admin'
      where lower(email) = ${cleanEmail}
      returning id, email, full_name, role
    `;
    if (!rows.length) {
      throw new ApiError(404, `${cleanEmail} already has a Supabase login, but no matching profile row was found`);
    }
    await sql`update admin_invites set status = 'claimed', claimed_at = now() where email = ${cleanEmail}`;
    log.info(`admin invite: ${cleanEmail} already had an account — promoted to admin directly`);
    return { status: 'promoted', email: cleanEmail };
  }

  throw new ApiError(502, `could not send invite: ${error.message}`);
}

export async function listInvites(): Promise<Row[]> {
  return sql<Row[]>`
    select ai.id, ai.email, ai.full_name, ai.status, ai.created_at, ai.claimed_at, ai.expires_at,
           p.full_name as invited_by_name, p.email as invited_by_email
    from admin_invites ai
    left join profiles p on p.id = ai.invited_by
    order by ai.created_at desc
  `;
}

export async function revokeInvite(id: string): Promise<void> {
  const rows = await sql<Row[]>`
    update admin_invites set status = 'revoked' where id = ${id}::uuid and status = 'pending' returning id
  `;
  if (!rows.length) throw new ApiError(404, 'invite not found or already resolved');
}
