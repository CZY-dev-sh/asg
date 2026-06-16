import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { log } from '../logger.js';
import { requireWrite } from '../auth.js';
import * as admin from '../repositories/admin.js';
import { ApiError } from '../repositories/admin.js';
import { upsertDealWorkflow } from '../repositories/crm.js';

const body = (req: FastifyRequest): Record<string, unknown> =>
  (req.body as Record<string, unknown>) ?? {};
const param = (req: FastifyRequest, key: string): string =>
  String((req.params as Record<string, string>)[key] ?? '');

function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof ApiError) return reply.code(err.status).send({ ok: false, error: err.message });
  log.error('admin route error', err);
  return reply.code(500).send({ ok: false, error: String(err) });
}

const STAFF: Array<'admin' | 'agent'> = ['admin', 'agent'];

/**
 * Admin / staff write API. The live UI is read-only today; these endpoints let
 * the dashboards (or a trusted server task) push edits back into Supabase once
 * they authenticate. Every route requires either:
 *   • a Supabase access token whose profile role is admin (or agent where noted)
 *   • the X-Asg-Secret header matching WEBHOOK_SECRET (server-to-server)
 */
export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  // ── Listings (admins + agents) ──────────────────────────────────────────
  app.post('/api/admin/listings', async (req, reply) => {
    if (!(await requireWrite(req, reply, STAFF))) return;
    try {
      return { ok: true, listing: await admin.createListing(body(req)) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.patch('/api/admin/listings/:id', async (req, reply) => {
    if (!(await requireWrite(req, reply, STAFF))) return;
    try {
      return { ok: true, listing: await admin.updateListing(param(req, 'id'), body(req)) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post('/api/admin/listings/:id/archive', async (req, reply) => {
    if (!(await requireWrite(req, reply, STAFF))) return;
    try {
      const archived = body(req).archived;
      return { ok: true, listing: await admin.setListingArchived(param(req, 'id'), archived === undefined ? true : Boolean(archived)) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post('/api/admin/listings/:id/cover', async (req, reply) => {
    if (!(await requireWrite(req, reply, STAFF))) return;
    try {
      const url = String(body(req).url ?? body(req).coverImageUrl ?? '');
      if (!url) return reply.code(400).send({ ok: false, error: 'url required' });
      return { ok: true, listing: await admin.setListingCover(param(req, 'id'), url) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post('/api/admin/listings/:id/photos', async (req, reply) => {
    if (!(await requireWrite(req, reply, STAFF))) return;
    try {
      const b = body(req);
      const photo = await admin.addListingPhoto(param(req, 'id'), {
        base64: b.base64 as string | undefined,
        url: b.url as string | undefined,
        contentType: b.contentType as string | undefined,
        filename: b.filename as string | undefined,
        caption: b.caption as string | undefined,
        position: b.position == null ? undefined : Number(b.position),
      });
      return { ok: true, photo };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.delete('/api/admin/photos/:photoId', async (req, reply) => {
    if (!(await requireWrite(req, reply, STAFF))) return;
    try {
      return await admin.deleteListingPhoto(param(req, 'photoId'));
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.delete('/api/admin/listings/:id', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return; // admin only
    try {
      return await admin.deleteListing(param(req, 'id'));
    } catch (err) {
      return fail(reply, err);
    }
  });

  // ── Deal workflow (admins + agents) — replaces the Deal Tracker sheet ────
  app.post('/api/admin/deal-workflow', async (req, reply) => {
    if (!(await requireWrite(req, reply, STAFF))) return;
    const b = body(req);
    const dealId = String(b.dealId ?? b.id ?? '');
    if (!dealId) return reply.code(400).send({ ok: false, error: 'dealId required' });
    try {
      return await upsertDealWorkflow(dealId, b);
    } catch (err) {
      return fail(reply, err);
    }
  });

  // ── Agents / directory (admin only) ─────────────────────────────────────
  app.post('/api/admin/agents', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      return { ok: true, agent: await admin.createAgent(body(req)) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.patch('/api/admin/agents/:id', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      return { ok: true, agent: await admin.updateAgent(param(req, 'id'), body(req)) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post('/api/admin/agents/:id/active', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      const active = body(req).active;
      return { ok: true, agent: await admin.setAgentActive(param(req, 'id'), active === undefined ? true : Boolean(active)) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post('/api/admin/agents/:id/headshot', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      const b = body(req);
      if (!b.base64) return reply.code(400).send({ ok: false, error: 'base64 required' });
      const agent = await admin.uploadHeadshot(param(req, 'id'), {
        base64: String(b.base64),
        contentType: b.contentType as string | undefined,
        filename: b.filename as string | undefined,
      });
      return { ok: true, agent };
    } catch (err) {
      return fail(reply, err);
    }
  });

  // ── Team events (admin only) ────────────────────────────────────────────
  app.post('/api/admin/events', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      return { ok: true, event: await admin.createEvent(body(req)) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.patch('/api/admin/events/:id', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      return { ok: true, event: await admin.updateEvent(param(req, 'id'), body(req)) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.delete('/api/admin/events/:id', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      return await admin.deleteEvent(param(req, 'id'));
    } catch (err) {
      return fail(reply, err);
    }
  });

  // ── Team updates / announcements (admin only) ───────────────────────────
  app.post('/api/admin/updates', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      return { ok: true, update: await admin.createUpdate(body(req)) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.patch('/api/admin/updates/:id', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      return { ok: true, update: await admin.updateUpdate(param(req, 'id'), body(req)) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.delete('/api/admin/updates/:id', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      return await admin.deleteUpdate(param(req, 'id'));
    } catch (err) {
      return fail(reply, err);
    }
  });

  // ── Leads (admin only) — triage onboarding submissions ──────────────────
  app.get('/api/admin/leads', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      const query = req.query as Record<string, string>;
      return await admin.listLeads({
        formType: query.formType,
        status: query.status,
        limit: query.limit ? Number(query.limit) : undefined,
      });
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.patch('/api/admin/leads/:id', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      return { ok: true, lead: await admin.updateLead(param(req, 'id'), body(req)) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  // ── Activity log (admin only) — per-admin usage + actions ───────────────
  app.get('/api/admin/activity', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      const query = req.query as Record<string, string>;
      return await admin.listActivity({
        email: query.email,
        limit: query.limit ? Number(query.limit) : undefined,
      });
    } catch (err) {
      return fail(reply, err);
    }
  });

  // ── Landing pages (admin only) ──────────────────────────────────────────
  app.put('/api/admin/landing/:slug/:pageType', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      return { ok: true, landing: await admin.upsertLanding(param(req, 'slug'), param(req, 'pageType'), body(req)) };
    } catch (err) {
      return fail(reply, err);
    }
  });
}
