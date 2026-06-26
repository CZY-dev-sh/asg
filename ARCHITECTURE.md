# Architecture

This document explains how the pieces of the ASG platform fit together and the
reasoning behind the main design decisions. For the exhaustive endpoint contract
and setup, see [`apps/backend/README.md`](apps/backend/README.md).

## The core idea

The team's tools used to be a collection of Google Apps Scripts, each hitting a
third-party API (Follow Up Boss, IDX/MLS, Drive, Asana, Acuity) live on every
page load. That is slow, fragile (an upstream outage breaks the website), and
impossible to join across sources.

This platform inverts that: a single **Supabase Postgres database is the system
of record**. Scheduled **sync jobs** pull each source into Supabase, and a typed
**serving API** reads only from Supabase. The website becomes fast, resilient,
and backed by relational data plus a photo CDN.

```
SOURCES ──(sync/ETL, scheduled)──▶ SUPABASE (Postgres + Storage) ──(serving API)──▶ UI SURFACES
```

## Components

### `apps/backend` — the platform
A Node 18 / Fastify / TypeScript service that talks to Postgres directly via
`postgres.js` (so the `listings_enriched` merge view and multi-table joins stay
simple). Internally it is organized as:

- `src/connectors/` — thin clients for each external API (FUB, IDX, Drive,
  Asana, Acuity, Anthropic). Each is feature-flag guarded and returns `null`
  when unconfigured, so partial configuration always works.
- `src/sync/` — ETL jobs + an orchestrator + a CLI. Each job records a
  `sync_runs` row (timing, record counts, errors).
- `src/repositories/` — shape database rows into the exact JSON the existing UI
  surfaces already consume, so cutover is a one-line base-URL change per page.
- `src/routes/` — Fastify serving + admin write-back routes.
- `src/agents/` — the AI listing-marketing agent (see below).
- `src/auth.ts` — Supabase Auth verification; roles enforced again at the
  database level with Row Level Security.

### `apps/admin-hub` — UI surfaces
The Squarespace code blocks and Apps Script modules for the admin/agent
dashboards. These are the consumers of the backend's serving API.

### `infra/pi-remote` — office TV kiosk
A dependency-free Node static server plus systemd units and rsync/SSH deploy
scripts that run the office TV dashboard on a Raspberry Pi, controllable from a
phone. It serves the repo workspace over HTTP on the local network.

### `design` / `docs` / `data`
Design references and scraped style extractions, system documentation, and
shared static data (team roster). Reference material, not application code.

## Two patterns worth calling out

### 1. Event-driven, best-effort side effects
A seller onboarding (`POST /api/intake`) creates a listing, mirrors the lead to
Follow Up Boss, ensures an Asana project, and enqueues an AI marketing job. Each
side effect is wrapped in its own `try/catch` so a failure in one never blocks
the others or the HTTP response the seller is waiting on. Slow or paid work
(like the model run) is pushed to an out-of-band worker, never the request path.

### 2. The AI marketing agent (drafts only)
```
seller intake ──▶ enqueueListingMarketing()      (idempotent: input_hash)
                        │
                        ▼
              listing_marketing_jobs  (queue + retry + cost audit)
                        │  worker claims (FOR UPDATE SKIP LOCKED)
                        ▼
        orchestrator ──▶ ResearchAgent (verified facts only)
                    └──▶ CopyAgent (on-brand package, grounded)
                        │  shared per-run token budget (hard ceiling)
                        ▼
              listing_marketing_drafts (status 'draft', versioned)
                        │
                        ▼
              listing_activity milestone  →  human review
```

Design decisions baked in from day one:

- **Idempotency:** the job is keyed on a hash of the questionnaire + MLS facts.
  The intake upsert (`on conflict (address_normalized)`) means a re-submitted
  form is common; an unchanged hash is a no-op, so it never triggers a paid run.
  A genuinely changed questionnaire produces a new hash, a new job, and a new
  draft version.
- **Grounding:** Research assembles only verified facts and flags anything
  unconfirmed for human verification; Copy writes strictly from those facts and
  the brand guide. The agent never invents a material, brand, view, or fact.
- **Cost control:** a `RunBudget` tracks cumulative tokens across every model
  call and aborts the moment a per-run ceiling is crossed, so a prompt-loop bug
  cannot run up a bill. The static brand guide is sent as a cached system block.
- **Brand guide as data:** the ASG voice lives in a `brand_guidelines` table
  (seeded from `src/data/brandGuide.ts`), so it is editable without a deploy.

## Configuration & security

- Every source is optional and feature-flag gated (`have.*` in `src/env.ts`);
  unconfigured sources are skipped and the API degrades gracefully.
- Secrets (`DATABASE_URL`, service-role key, API keys) are server-only and read
  from the environment. Sync/admin endpoints require either a shared
  `WEBHOOK_SECRET` (server-to-server) or a logged-in admin/agent Supabase token.
- Row Level Security is the database-level backstop: clients see only their own
  data, agents only their own book, admins everything.

## Deployment

The backend runs on Railway (Nixpacks, `npm run build` → `npm start`, health
check `/health`) with `apps/backend` as the service root. The Pi kiosk is
deployed from `infra/pi-remote` over SSH/rsync. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
