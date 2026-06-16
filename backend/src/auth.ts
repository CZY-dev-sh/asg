import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env, have } from './env.js';
import { supabase } from './storage.js';
import { sql } from './db/client.js';

let anon: SupabaseClient | null = null;

/** Anon client — used for signup / password login proxy (browser-safe key). */
export function anonClient(): SupabaseClient {
  if (!have.authSignup()) throw new Error('Supabase Auth signup not configured (SUPABASE_ANON_KEY)');
  if (!anon) {
    anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return anon;
}

export interface Profile {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  role: 'client' | 'agent' | 'admin';
  agentId: string | null;
  contactId: string | null;
}

export interface AuthContext {
  userId: string;
  email: string | null;
  profile: Profile | null;
}

function bearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
}

/** Verify a Supabase access token and load the linked profile. */
export async function getAuthContext(req: FastifyRequest): Promise<AuthContext | null> {
  if (!have.auth()) return null;
  const token = bearer(req);
  if (!token) return null;
  const { data, error } = await supabase().auth.getUser(token);
  if (error || !data.user) return null;
  const profile = await loadProfile(data.user.id);
  return { userId: data.user.id, email: data.user.email ?? null, profile };
}

export async function loadProfile(userId: string): Promise<Profile | null> {
  const [row] = await sql<Record<string, unknown>[]>`
    select id, email, full_name, phone, role, agent_id, contact_id
    from profiles where id = ${userId} limit 1
  `;
  if (!row) return null;
  return {
    id: String(row.id),
    email: (row.email as string) ?? null,
    fullName: (row.full_name as string) ?? null,
    phone: (row.phone as string) ?? null,
    role: row.role as Profile['role'],
    agentId: (row.agent_id as string) ?? null,
    contactId: (row.contact_id as string) ?? null,
  };
}

/** Resolve auth context or send 401. Returns null when unauthorized. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<AuthContext | null> {
  const ctx = await getAuthContext(req);
  if (!ctx) {
    reply.code(401).send({ ok: false, error: 'authentication required' });
    return null;
  }
  return ctx;
}

export async function requireAgent(req: FastifyRequest, reply: FastifyReply): Promise<AuthContext | null> {
  const ctx = await requireAuth(req, reply);
  if (!ctx) return null;
  const role = ctx.profile?.role;
  if (role !== 'agent' && role !== 'admin') {
    reply.code(403).send({ ok: false, error: 'agent access required' });
    return null;
  }
  return ctx;
}

/** Synthetic admin context for trusted server-to-server (X-Asg-Secret) writes. */
const SERVICE_CONTEXT: AuthContext = {
  userId: 'service',
  email: null,
  profile: {
    id: 'service',
    email: null,
    fullName: 'Service (X-Asg-Secret)',
    phone: null,
    role: 'admin',
    agentId: null,
    contactId: null,
  },
};

function presentedSecret(req: FastifyRequest): string | null {
  const header = req.headers['x-asg-secret'];
  if (typeof header === 'string' && header) return header;
  const body = req.body as Record<string, unknown> | undefined;
  if (body && typeof body.secret === 'string') return body.secret;
  return null;
}

/**
 * Authorize a write. Two accepted credentials, in order:
 *   1. X-Asg-Secret matching WEBHOOK_SECRET → trusted automation / admin tool
 *      (treated as admin). Use this for server-side scripts, curl, Postman.
 *   2. A Supabase access token (Bearer) whose profile role is in `roles`.
 *      This is how the dashboards will write once an admin login is wired up.
 *
 * Sends 401/403 and returns null when the request is not allowed.
 */
export async function requireWrite(
  req: FastifyRequest,
  reply: FastifyReply,
  roles: Array<Profile['role']> = ['admin'],
): Promise<AuthContext | null> {
  const secret = presentedSecret(req);
  if (env.WEBHOOK_SECRET && secret && secret === env.WEBHOOK_SECRET) {
    return SERVICE_CONTEXT;
  }
  const ctx = await getAuthContext(req);
  if (!ctx) {
    reply.code(401).send({ ok: false, error: 'authentication required' });
    return null;
  }
  if (!ctx.profile || !roles.includes(ctx.profile.role)) {
    reply.code(403).send({ ok: false, error: `requires role: ${roles.join(' or ')}` });
    return null;
  }
  return ctx;
}

/** Admin-only write (or X-Asg-Secret). */
export const requireAdmin = (req: FastifyRequest, reply: FastifyReply) => requireWrite(req, reply, ['admin']);
