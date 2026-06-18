import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../env.js';
import { log } from '../logger.js';
import * as listings from '../repositories/listings.js';
import * as pipeline from '../repositories/pipeline.js';
import * as crm from '../repositories/crm.js';
import * as directory from '../repositories/directory.js';
import * as telemetry from '../repositories/telemetry.js';
import { getCommandCenter } from '../repositories/commandCenter.js';
import { getMarketingOutput, getMarketingDashboard } from '../repositories/marketing.js';
import { handleIntake } from '../repositories/intake.js';
import { handleAcuityWebhook } from '../sync/marketing.js';
import * as portal from '../repositories/portal.js';
import * as admin from '../repositories/admin.js';
import { anonClient, requireAuth, requireAgent } from '../auth.js';
import { have } from '../env.js';
import { runJob, type SyncJob } from '../sync/index.js';

const q = (req: FastifyRequest, key: string): string | undefined => {
  const v = (req.query as Record<string, unknown>)[key];
  return v == null ? undefined : String(v);
};

function requireSecret(req: FastifyRequest, reply: FastifyReply): boolean {
  const provided =
    (req.headers['x-asg-secret'] as string) ||
    q(req, 'secret') ||
    ((req.body as Record<string, unknown>)?.secret as string);
  if (!env.WEBHOOK_SECRET || provided !== env.WEBHOOK_SECRET) {
    reply.code(401).send({ ok: false, error: 'unauthorized' });
    return false;
  }
  return true;
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // ── Listings (replaces Listings V1/V2 + Listing Hub) ──────────────────
  app.get('/api/listings', async (req, reply) => {
    const view = (q(req, 'view') ?? 'active').toLowerCase();
    try {
      switch (view) {
        case 'home':
          return { success: true, listings: await listings.getHome() };
        case 'active':
          return { success: true, listings: await listings.getActive() };
        case 'search':
          // Public /search-homes feed — full MLS inventory straight from IDX.
          return { success: true, listings: await listings.getSearchInventory() };
        case 'archive':
        case 'closed':
          return { success: true, listings: await listings.getArchive() };
        case 'all':
          return { success: true, listings: await listings.getAll() };
        case 'listing': {
          const address = q(req, 'address');
          if (!address) return reply.code(400).send({ success: false, error: 'address required' });
          const listing = await listings.getListingByAddress(address);
          return listing ? { success: true, listing } : reply.code(404).send({ success: false, error: 'not found' });
        }
        case 'listingphotos':
        case 'photos': {
          const result = await listings.getPhotosFor({
            address: q(req, 'address'),
            listingId: q(req, 'listingId'),
            idxListingId: q(req, 'idxListingId'),
            folderId: q(req, 'folderId') ?? q(req, 'photosUrl'),
          });
          return { success: true, ...result, images: result.photos };
        }
        case 'idxsync':
          return listings.getIdxSyncStatus();
        default:
          return reply.code(400).send({ success: false, error: `unknown view ${view}` });
      }
    } catch (err) {
      log.error('listings route error', err);
      return reply.code(500).send({ success: false, error: String(err) });
    }
  });

  // Dedicated photos endpoint (carousel)
  app.get('/api/photos', async (req, reply) => {
    try {
      const result = await listings.getPhotosFor({
        address: q(req, 'address'),
        listingId: q(req, 'listingId'),
        idxListingId: q(req, 'idxListingId'),
        folderId: q(req, 'folderId') ?? q(req, 'photosUrl'),
      });
      return { success: true, ...result, images: result.photos };
    } catch (err) {
      return reply.code(500).send({ success: false, error: String(err) });
    }
  });

  // ── Pipeline Stats ─────────────────────────────────────────────────────
  app.get('/api/pipeline-stats', async (req) => {
    if ((q(req, 'view') ?? '') === 'pipeline') return pipeline.getPipelineRaw();
    return pipeline.getPipelineStats(q(req, 'period') ?? 'ytd2026');
  });
  app.get('/api/pipeline-deals', async (req) =>
    pipeline.getPipelineDeals(q(req, 'kind') as 'buyer' | 'seller' | undefined),
  );

  // ── FUB Agent Hub / Deal Tracker / Schema ─────────────────────────────
  app.get('/api/fub-hub', async (req) => {
    const view = (q(req, 'view') ?? '').toLowerCase();
    if (view === 'schema') return crm.getFubSchema();
    if (view === 'dealtracker') {
      return crm.getDealTracker({ email: q(req, 'agentEmail'), name: q(req, 'agentName') });
    }
    return crm.getAgentHub({
      email: q(req, 'agentEmail'),
      name: q(req, 'agentName'),
      limit: q(req, 'limit') ? Number(q(req, 'limit')) : undefined,
    });
  });
  app.post('/api/fub-hub/deal-workflow', async (req, reply) => {
    if (!requireSecret(req, reply)) return;
    const body = (req.body as Record<string, unknown>) ?? {};
    const dealId = String(body.dealId ?? body.id ?? '');
    if (!dealId) return reply.code(400).send({ ok: false, error: 'dealId required' });
    return crm.upsertDealWorkflow(dealId, body);
  });

  // ── Command Center ─────────────────────────────────────────────────────
  app.get('/api/command-center', async (req) =>
    getCommandCenter(q(req, 'view') ?? 'all', q(req, 'period') ?? '30d'),
  );

  // ── Hub Data (directory / events / updates / landing) ──────────────────
  app.get('/api/hub-data', async (req) =>
    directory.getHubData((q(req, 'view') ?? 'all').toLowerCase(), {
      slug: q(req, 'slug'),
      page: q(req, 'page'),
    }),
  );
  app.get('/api/directory', async () => ({ success: true, directory: await directory.getDirectory() }));

  // ── Usage Log (telemetry beacon) ───────────────────────────────────────
  app.post('/api/usage-log', async (req, reply) => {
    try {
      const body = (req.body as Record<string, unknown>) ?? {};
      await telemetry.insertUsageEvent({
        ...body,
        user_agent: (body.user_agent as string) ?? (req.headers['user-agent'] as string),
      });
      return { ok: true };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: String(err) });
    }
  });
  app.get('/api/usage-log', async () => ({ ok: true, service: 'usage-log', status: 'healthy' }));

  // ── Recent Drive folders ───────────────────────────────────────────────
  app.get('/api/recent-folders', async () => telemetry.getRecentFolders());

  // ── Marketing output ────────────────────────────────────────────────────
  app.get('/api/marketing-output', async (req) =>
    getMarketingOutput(q(req, 'days') ? Number(q(req, 'days')) : 30),
  );

  // ── Marketing dashboard (schedule + Acuity/Asana/Gmail performance) ──────
  app.get('/api/marketing-dashboard', async (req) =>
    getMarketingDashboard(q(req, 'days') ? Number(q(req, 'days')) : 30),
  );

  // ── Lead intake (buyer/seller onboarding) ──────────────────────────────
  app.post('/api/intake', async (req, reply) => {
    try {
      const ip = (req.headers['x-forwarded-for'] as string) ?? req.ip;
      const result = await handleIntake((req.body as Record<string, unknown>) ?? {}, ip);
      return reply.code(result.success ? 200 : 400).send(result);
    } catch (err) {
      log.error('intake route error', err);
      return reply.code(500).send({ success: false, error: String(err) });
    }
  });

  // ── Acuity webhook (realtime media booking → listing) ───────────────────
  // Acuity posts form-encoded { action, id, appointmentID }. Authorize with the
  // shared secret via ?secret= (configure it on the webhook URL in Acuity).
  app.post('/api/webhooks/acuity', async (req, reply) => {
    if (!requireSecret(req, reply)) return;
    const b = (req.body as Record<string, unknown>) ?? {};
    const appointmentId = String(b.appointmentID ?? b.id ?? q(req, 'id') ?? '');
    if (!appointmentId) return reply.code(400).send({ ok: false, error: 'appointmentID required' });
    try {
      return await handleAcuityWebhook(appointmentId);
    } catch (err) {
      log.error('acuity webhook error', err);
      return reply.code(500).send({ ok: false, error: String(err) });
    }
  });

  // ── Sync triggers (secured) ─────────────────────────────────────────────
  app.post('/api/sync/:job', async (req, reply) => {
    if (!requireSecret(req, reply)) return;
    const job = (req.params as { job: string }).job as SyncJob;
    const mirrorIdx = q(req, 'mirrorIdx') === '1';
    const result = await runJob(job, { mirrorIdx });
    if (!result) return reply.code(400).send({ ok: false, error: `unknown job ${job}` });
    return result;
  });

  // ── Auth (Supabase Auth proxy) ─────────────────────────────────────────
  // Clients: any email → client account. Agents: must use their @compass.com
  // roster email (enforced by the handle_new_user DB trigger).
  app.post('/api/auth/signup', async (req, reply) => {
    if (!have.authSignup()) return reply.code(501).send({ ok: false, error: 'auth not configured' });
    const body = (req.body as Record<string, unknown>) ?? {};
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    if (!email || !password) return reply.code(400).send({ ok: false, error: 'email and password required' });
    const { data, error } = await anonClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: String(body.fullName ?? body.full_name ?? '') } },
    });
    if (error) return reply.code(400).send({ ok: false, error: error.message });
    return {
      ok: true,
      userId: data.user?.id ?? null,
      needsConfirmation: !data.session,
      session: data.session ?? null,
    };
  });

  app.post('/api/auth/login', async (req, reply) => {
    if (!have.authSignup()) return reply.code(501).send({ ok: false, error: 'auth not configured' });
    const body = (req.body as Record<string, unknown>) ?? {};
    const { data, error } = await anonClient().auth.signInWithPassword({
      email: String(body.email ?? '').trim().toLowerCase(),
      password: String(body.password ?? ''),
    });
    if (error) return reply.code(401).send({ ok: false, error: error.message });
    return { ok: true, session: data.session, user: { id: data.user?.id, email: data.user?.email } };
  });

  app.get('/api/auth/me', async (req, reply) => {
    const ctx = await requireAuth(req, reply);
    if (!ctx) return;
    return { ok: true, userId: ctx.userId, email: ctx.email, profile: ctx.profile };
  });

  // Edit your own account (name / phone). Role is protected at the DB level.
  app.patch('/api/auth/me', async (req, reply) => {
    const ctx = await requireAuth(req, reply);
    if (!ctx) return;
    const body = (req.body as Record<string, unknown>) ?? {};
    try {
      const profile = await admin.updateOwnProfile(ctx.userId, {
        fullName: body.fullName ?? body.full_name,
        phone: body.phone,
      });
      return { ok: true, profile };
    } catch (err) {
      const status = err instanceof admin.ApiError ? err.status : 500;
      return reply.code(status).send({ ok: false, error: String(err instanceof Error ? err.message : err) });
    }
  });

  // ── Client portal ───────────────────────────────────────────────────────
  app.get('/api/portal/deals', async (req, reply) => {
    const ctx = await requireAuth(req, reply);
    if (!ctx) return;
    if (!ctx.profile?.contactId) return { ok: true, deals: [], note: 'no linked contact yet' };
    return { ok: true, deals: await portal.getClientDeals(ctx.profile.contactId) };
  });

  app.get('/api/portal/onboarding/:formType', async (req, reply) => {
    const ctx = await requireAuth(req, reply);
    if (!ctx) return;
    const formType = (req.params as { formType: string }).formType;
    return { ok: true, draft: await portal.getDraft(ctx.userId, formType) };
  });

  app.put('/api/portal/onboarding/:formType', async (req, reply) => {
    const ctx = await requireAuth(req, reply);
    if (!ctx) return;
    const formType = (req.params as { formType: string }).formType;
    const body = (req.body as Record<string, unknown>) ?? {};
    return portal.saveDraft(ctx.userId, formType, Number(body.step) || 0, (body.data as Record<string, unknown>) ?? {});
  });

  app.post('/api/portal/onboarding/:formType/submit', async (req, reply) => {
    const ctx = await requireAuth(req, reply);
    if (!ctx) return;
    const formType = (req.params as { formType: string }).formType;
    const body = (req.body as Record<string, unknown>) ?? {};
    const result = await portal.submitDraft(ctx.userId, formType, body);
    return reply.code(result.success ? 200 : 400).send(result);
  });

  // ── Agent portal (self-scoped — agents only see their own book) ─────────
  app.get('/api/portal/agent/hub', async (req, reply) => {
    const ctx = await requireAgent(req, reply);
    if (!ctx) return;
    const limit = q(req, 'limit') ? Number(q(req, 'limit')) : undefined;
    return crm.getAgentHub({ email: ctx.email ?? undefined, name: ctx.profile?.fullName ?? undefined, limit });
  });

  app.get('/api/portal/agent/deal-tracker', async (req, reply) => {
    const ctx = await requireAgent(req, reply);
    if (!ctx) return;
    return crm.getDealTracker({ email: ctx.email ?? undefined });
  });
}
