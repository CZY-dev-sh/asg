import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env, have } from './env.js';
import { log } from './logger.js';
import { pingDb, closeDb } from './db/client.js';
import { registerRoutes } from './routes/api.js';
import { registerAdminRoutes } from './routes/admin.js';
import { startScheduler } from './scheduler.js';

async function main() {
  // Body limit is generous so admins can upload listing photos / headshots
  // as base64 from the dashboard. Tune down if you move to multipart uploads.
  const app = Fastify({ logger: false, trustProxy: true, bodyLimit: 30 * 1024 * 1024 });

  // CORS — Squarespace surfaces call this API cross-origin.
  const origins = env.CORS_ORIGINS;
  await app.register(cors, {
    origin: origins.length === 0 || origins.includes('*') ? true : origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Asg-Secret', 'Authorization'],
  });

  await app.register(rateLimit, { max: 600, timeWindow: '1 minute' });

  // Preserve the exact raw request body alongside Fastify's normal JSON parsing.
  // Needed for the FUB webhook route, which must HMAC the *exact bytes* FUB
  // sent (not a re-serialized copy) to verify the FUB-Signature header.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    (req as unknown as { rawBody: string }).rawBody = body as string;
    try {
      done(null, body ? JSON.parse(body as string) : {});
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.get('/health', async () => ({
    ok: true,
    service: 'asg-backend',
    time: new Date().toISOString(),
    db: await pingDb(),
    sources: {
      supabaseStorage: have.supabaseStorage(),
      fub: have.fub(),
      idx: have.idx(),
      drive: have.drive(),
      asana: have.asana(),
      acuity: have.acuity(),
      pipeline: have.pipeline(),
    },
  }));
  app.get('/', async () => ({ ok: true, service: 'asg-backend', docs: '/health' }));

  await registerRoutes(app);
  await registerAdminRoutes(app);

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    log.info(`asg-backend listening on :${env.PORT} (${env.NODE_ENV})`);
  } catch (err) {
    log.error('failed to start server', err);
    process.exit(1);
  }

  startScheduler();

  const shutdown = async (sig: string) => {
    log.info(`${sig} received — shutting down`);
    await app.close();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  log.error('fatal', err);
  process.exit(1);
});
