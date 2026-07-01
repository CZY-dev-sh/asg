import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { log } from '../logger.js';
import { requireWrite, type AuthContext } from '../auth.js';
import * as admin from '../repositories/admin.js';
import { ApiError } from '../repositories/admin.js';
import * as listingsRepo from '../repositories/listings.js';
import * as marketingTasks from '../repositories/marketingTasks.js';
import { getCalendar } from '../repositories/marketing.js';
import { buildBookingUrl } from '../connectors/acuity.js';
import { upsertDealWorkflow } from '../repositories/crm.js';
import * as adminInvites from '../repositories/adminInvites.js';

/** Display name to attribute a write to (admin full name, email, or service). */
const actorOf = (ctx: AuthContext): string =>
  ctx.profile?.fullName ?? ctx.email ?? ctx.profile?.email ?? 'admin';

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
  // ── Listing edits + images: ADMIN ONLY ──────────────────────────────────
  // Agents get read-only access to the workshop (GET routes below) and may
  // request/book marketing, but only admins can create/edit listings, change
  // status, or upload/manage images.
  app.post('/api/admin/listings', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return; // admin only
    try {
      return { ok: true, listing: await admin.createListing(body(req)) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.patch('/api/admin/listings/:id', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return; // admin only
    try {
      return { ok: true, listing: await admin.updateListing(param(req, 'id'), body(req)) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post('/api/admin/listings/:id/archive', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return; // admin only
    try {
      const archived = body(req).archived;
      return { ok: true, listing: await admin.setListingArchived(param(req, 'id'), archived === undefined ? true : Boolean(archived)) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post('/api/admin/listings/:id/cover', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return; // admin only
    try {
      const url = String(body(req).url ?? body(req).coverImageUrl ?? '');
      if (!url) return reply.code(400).send({ ok: false, error: 'url required' });
      return { ok: true, listing: await admin.setListingCover(param(req, 'id'), url) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post('/api/admin/listings/:id/photos', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return; // admin only
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
    if (!(await requireWrite(req, reply))) return; // admin only
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

  // ── Listing workshop (admins + agents) ──────────────────────────────────
  // Full detail: listing + appointments + requests + activity timeline.
  app.get('/api/admin/listings/:id', async (req, reply) => {
    if (!(await requireWrite(req, reply, STAFF))) return;
    try {
      const listing = await listingsRepo.getListingDetail(param(req, 'id'));
      if (!listing) return reply.code(404).send({ ok: false, error: 'listing not found' });
      return { ok: true, listing };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get('/api/admin/listings/:id/activity', async (req, reply) => {
    if (!(await requireWrite(req, reply, STAFF))) return;
    try {
      return { ok: true, activity: await listingsRepo.getActivity(param(req, 'id')) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  // Signed direct-to-Storage upload targets (browser PUTs the bytes itself).
  app.post('/api/admin/listings/:id/photo-uploads', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return; // admin only
    try {
      const files = (body(req).files ?? body(req).photos) as Array<{ name?: string; contentType?: string }>;
      return { ok: true, uploads: await admin.signListingUploads(param(req, 'id'), files) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  // Register photos that were uploaded via the signed URLs above.
  app.post('/api/admin/listings/:id/photos/register', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return; // admin only
    try {
      const photos = body(req).photos as Array<{ path: string; caption?: string; position?: number; contentType?: string }>;
      return { ok: true, photos: await admin.registerListingPhotos(param(req, 'id'), photos) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post('/api/admin/listings/:id/photos/reorder', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return; // admin only
    try {
      const order = (body(req).order ?? body(req).ids) as string[];
      return await admin.reorderListingPhotos(param(req, 'id'), order);
    } catch (err) {
      return fail(reply, err);
    }
  });

  // Prefilled Acuity booking URL for the "Book media" button.
  app.get('/api/admin/listings/:id/acuity-link', async (req, reply) => {
    if (!(await requireWrite(req, reply, STAFF))) return;
    try {
      const listing = await listingsRepo.getListingDetail(param(req, 'id'));
      if (!listing) return reply.code(404).send({ ok: false, error: 'listing not found' });
      const url = buildBookingUrl({
        address: listing.address,
        agentName: listing.coListAgentName ?? listing.agent ?? undefined,
      });
      return { ok: true, url, address: listing.address };
    } catch (err) {
      return fail(reply, err);
    }
  });

  // Marketing requests (create drives Asana; list returns live status).
  app.get('/api/admin/listings/:id/requests', async (req, reply) => {
    if (!(await requireWrite(req, reply, STAFF))) return;
    try {
      return { ok: true, requests: await listingsRepo.getRequests(param(req, 'id')) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post('/api/admin/listings/:id/requests', async (req, reply) => {
    const ctx = await requireWrite(req, reply, STAFF);
    if (!ctx) return;
    try {
      if (ctx.profile?.role === 'agent') {
        const ok = await admin.canAgentAccessListing({
          listingId: param(req, 'id'),
          agentId: ctx.profile.agentId,
          email: ctx.email ?? ctx.profile.email,
        });
        if (!ok) return reply.code(403).send({ ok: false, error: 'listing access required' });
      }
      const b = body(req);
      const request = await admin.createRequest(param(req, 'id'), {
        kind: b.kind as string | undefined,
        notes: b.notes as string | undefined,
        materials: b.materials,
        assignee: b.assignee as string | undefined,
        requestedBy: actorOf(ctx),
      });
      return { ok: true, request };
    } catch (err) {
      return fail(reply, err);
    }
  });

  // Toggle a listing request's status from the hub (complete / reopen / cancel).
  // Flips the listing asset status + best-effort mirrors completion to Asana.
  app.patch('/api/admin/listings/:id/requests/:requestId', async (req, reply) => {
    const ctx = await requireWrite(req, reply);
    if (!ctx) return;
    try {
      const status = body(req).status as 'requested' | 'in_progress' | 'done' | 'cancelled';
      const ok = await admin.setRequestStatus(param(req, 'requestId'), status, actorOf(ctx));
      if (!ok) return reply.code(404).send({ ok: false, error: 'request not found' });
      return { ok: true };
    } catch (err) {
      return fail(reply, err);
    }
  });

  // Agents (id + name + email) for the assignment picker.
  app.get('/api/admin/agents', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      return { ok: true, agents: await admin.listAgents() };
    } catch (err) {
      return fail(reply, err);
    }
  });

  // ── Marketing workload + tasks (admin: assign + track across all agents) ──
  // Per-agent workload across general tasks + listing requests.
  app.get('/api/admin/marketing/workload', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      return { ok: true, workload: await marketingTasks.agentWorkload() };
    } catch (err) {
      return fail(reply, err);
    }
  });

  // All marketing work for one agent (?agentId=).
  app.get('/api/admin/marketing/tasks', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      const agentId = String((req.query as Record<string, string>)?.agentId ?? '');
      if (!agentId) return reply.code(400).send({ ok: false, error: 'agentId required' });
      return { ok: true, tasks: await marketingTasks.listForAgent(agentId) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  // Create + assign a marketing task to any agent.
  app.post('/api/admin/marketing/tasks', async (req, reply) => {
    const ctx = await requireWrite(req, reply);
    if (!ctx) return;
    try {
      const b = body(req);
      if (!b.agentId || !b.title) return reply.code(400).send({ ok: false, error: 'agentId and title required' });
      const task = await marketingTasks.createTask({
        agentId: String(b.agentId),
        title: String(b.title),
        category: b.category as string | undefined,
        notes: b.notes as string | undefined,
        assignee: b.assignee as string | undefined,
        dueOn: b.dueOn as string | undefined,
        listingId: b.listingId as string | undefined,
        requestedBy: actorOf(ctx),
        source: 'admin',
        materials: b.materials,
      });
      return { ok: true, task };
    } catch (err) {
      return fail(reply, err);
    }
  });

  // Update a marketing task: status (complete/reopen/cancel) and/or reassign.
  app.patch('/api/admin/marketing/tasks/:id', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      const b = body(req);
      const id = param(req, 'id');
      let task = null;
      if (b.agentId !== undefined || b.assignee !== undefined) {
        task = await marketingTasks.reassign(id, b.agentId as string | undefined, b.assignee as string | undefined);
      }
      if (b.status) {
        task = await marketingTasks.setStatus(id, b.status as marketingTasks.TaskStatus);
      }
      if (!task) return reply.code(404).send({ ok: false, error: 'task not found' });
      return { ok: true, task };
    } catch (err) {
      return fail(reply, err);
    }
  });

  // Share the finished package with the (co-)agent — returns a prefilled compose.
  app.post('/api/admin/listings/:id/share', async (req, reply) => {
    const ctx = await requireWrite(req, reply, STAFF);
    if (!ctx) return;
    try {
      return { ok: true, ...(await admin.buildShareEmail(param(req, 'id'), actorOf(ctx))) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  // Admin calendar feed (Acuity media + meetings + team events).
  app.get('/api/admin/calendar', async (req, reply) => {
    if (!(await requireWrite(req, reply, STAFF))) return;
    try {
      const days = (req.query as Record<string, string>).days;
      return await getCalendar({ days: days ? Number(days) : undefined });
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

  // ── Directory bulk sync (admin only) — the "ASG Directory" Google Sheet
  //    pushes every row here via Apps Script; this is the source of truth. ──
  app.post('/api/admin/directory', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      const b = body(req);
      const rows = (b.directory ?? b.rows ?? b.agents) as unknown;
      const deactivateMissing = b.deactivateMissing === undefined ? true : Boolean(b.deactivateMissing);
      return await admin.upsertDirectory(rows, { deactivateMissing });
    } catch (err) {
      return fail(reply, err);
    }
  });

  // ── Admin invites (admin only) — onboarding a new ops/leadership hire.
  //    Grants role=admin via the invite record itself (see 0020_admin_invites.sql),
  //    not domain/roster inference. Uses Supabase's own invite email. ──
  app.post('/api/admin/invites', async (req, reply) => {
    const ctx = await requireWrite(req, reply);
    if (!ctx) return;
    try {
      const b = body(req);
      const email = String(b.email ?? '');
      const fullName = b.fullName != null ? String(b.fullName) : (b.full_name != null ? String(b.full_name) : undefined);
      const invitedBy = ctx.userId === 'service' ? null : ctx.userId;
      const result = await adminInvites.createInvite(invitedBy, email, fullName);
      return { ok: true, ...result };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get('/api/admin/invites', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      return { ok: true, invites: await adminInvites.listInvites() };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.delete('/api/admin/invites/:id', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      await adminInvites.revokeInvite(param(req, 'id'));
      return { ok: true };
    } catch (err) {
      return fail(reply, err);
    }
  });

  // ── Hub content bulk sync (admin only) — the Hub Data sheet pushes its
  //    "Events" and "Updates" tabs here so Supabase mirrors them. ──
  app.post('/api/admin/hub-content', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      const b = body(req);
      return await admin.upsertHubContent({
        events: b.events ?? (b.data as Record<string, unknown> | undefined)?.events,
        updates: b.updates ?? (b.data as Record<string, unknown> | undefined)?.updates,
      });
    } catch (err) {
      return fail(reply, err);
    }
  });

  // ── Listings workflow import (admin only) — the Listing Hub sheet pushes its
  //    "Listings"/"Marketing" overlay rows here, keyed by address. ──
  app.post('/api/admin/listings/import', async (req, reply) => {
    if (!(await requireWrite(req, reply))) return;
    try {
      const b = body(req);
      const rows = (b.listings ?? b.rows ?? b.overlay) as unknown;
      return await admin.upsertListingsWorkflow(rows);
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
