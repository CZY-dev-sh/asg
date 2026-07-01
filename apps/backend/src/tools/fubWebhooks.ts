import { env } from '../env.js';
import { log } from '../logger.js';
import { fubClient } from '../connectors/fub.js';

/**
 * `npm run fub:webhooks -- <list|register|unregister-all>` — manage the FUB
 * webhooks that drive near-real-time sync (see docs/FUB-DATA-STANDARDS.md).
 *
 * PREREQUISITE (one-time, manual, requires the FUB account owner):
 *   Register this integration as a FUB "system" at
 *   https://apps.followupboss.com/system-registration — FUB will issue an
 *   X-System name + X-System-Key secret. Put those in Railway/`.env` as
 *   FUB_SYSTEM_NAME and FUB_SYSTEM_KEY before running `register`. Creating
 *   webhooks is restricted to the account owner's API key (FUB_API_KEY must
 *   belong to the owner).
 *
 * Usage:
 *   npm run fub:webhooks -- list
 *   npm run fub:webhooks -- register        (idempotent — skips events already registered to our URL)
 *   npm run fub:webhooks -- unregister-all   (cleans up every webhook registered to our callback URL)
 */

const EVENTS = [
  'peopleCreated',
  'peopleUpdated',
  'peopleDeleted',
  'dealsCreated',
  'dealsUpdated',
  'dealsDeleted',
  'tasksCreated',
  'tasksUpdated',
  'notesCreated',
  'appointmentsCreated',
  'appointmentsUpdated',
];

interface FubWebhook {
  id: number;
  event: string;
  url: string;
  status: string;
}

type Fub = NonNullable<ReturnType<typeof fubClient>>;

function callbackUrl(): string {
  const base = env.PUBLIC_BACKEND_URL.replace(/\/$/, '');
  if (!base) {
    log.error('PUBLIC_BACKEND_URL is not set — e.g. https://asg-production.up.railway.app');
    process.exit(1);
  }
  return `${base}/api/webhooks/fub`;
}

async function listWebhooks(fub: Fub): Promise<FubWebhook[]> {
  const data = await fub.get<{ webhooks: FubWebhook[] }>('/webhooks');
  return data.webhooks ?? [];
}

async function main(): Promise<void> {
  const cmd = (process.argv[2] ?? 'list').trim();
  if (!env.FUB_API_KEY) {
    log.error('FUB_API_KEY is not set.');
    process.exit(1);
  }
  if (!env.FUB_SYSTEM_KEY) {
    log.error(
      'FUB_SYSTEM_KEY is not set. Register this system at https://apps.followupboss.com/system-registration ' +
        'first (one-time, account owner only), then set FUB_SYSTEM_NAME + FUB_SYSTEM_KEY.',
    );
    process.exit(1);
  }
  const fub = fubClient();
  if (!fub) {
    log.error('FUB client not configured.');
    process.exit(1);
  }

  switch (cmd) {
    case 'list': {
      const hooks = await listWebhooks(fub);
      if (!hooks.length) {
        console.log('No webhooks registered for this system.');
        return;
      }
      for (const h of hooks) console.log(`  #${h.id}  ${h.event.padEnd(22)} ${h.status.padEnd(10)} -> ${h.url}`);
      return;
    }
    case 'register': {
      const url = callbackUrl();
      const existing = await listWebhooks(fub);
      console.log(`Registering ${EVENTS.length} event(s) -> ${url}`);
      for (const event of EVENTS) {
        const already = existing.find((h) => h.event === event && h.url === url);
        if (already) {
          console.log(`  ${event.padEnd(22)} already registered (#${already.id}, ${already.status})`);
          continue;
        }
        try {
          const created = await fub.post<FubWebhook>('/webhooks', { event, url });
          console.log(`  ${event.padEnd(22)} registered -> #${created.id}`);
        } catch (err) {
          console.log(`  ${event.padEnd(22)} FAILED: ${String(err)}`);
        }
      }
      return;
    }
    case 'unregister-all': {
      const url = callbackUrl();
      const ours = (await listWebhooks(fub)).filter((h) => h.url === url);
      if (!ours.length) {
        console.log('Nothing to unregister for this callback URL.');
        return;
      }
      for (const h of ours) {
        await fub.del(`/webhooks/${h.id}`);
        console.log(`  deleted #${h.id} (${h.event})`);
      }
      return;
    }
    default:
      console.log('Usage: npm run fub:webhooks -- <list|register|unregister-all>');
  }
}

main().catch((err) => {
  log.error('fub:webhooks failed', err);
  process.exit(1);
});
