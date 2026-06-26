# Alex Stoykov Group — Real Estate Platform

A production system for a Chicago real estate team (the Alex Stoykov Group, operating under Compass). It replaces a sprawl of per-page Google Apps Scripts with **one Supabase system-of-record**, a typed **Fastify API**, and an **AI agent** that drafts on-brand, Fair-Housing-aware listing marketing for human review.

This is a working system, not a demo: it ingests Follow Up Boss, IDX/MLS, Google Drive, Asana, and Acuity into Postgres; serves every public and internal UI surface; and powers a client/agent portal backed by Supabase Auth and Row Level Security.

> **Looking for the engineering?** Start with [`apps/backend`](apps/backend) — it's the core of this repo. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for how the pieces fit together.

---

## Repository layout

| Path | What it is | Stack |
|---|---|---|
| [`apps/backend`](apps/backend) | **The platform.** Supabase system-of-record, sync/ETL jobs, serving + admin API, auth/portal, and the AI listing-marketing agent. | TypeScript, Node 18, Fastify, Postgres (postgres.js), Supabase, Anthropic SDK, node-cron, Zod |
| [`apps/admin-hub`](apps/admin-hub) | Squarespace code blocks and Google Apps Script modules for the admin/agent dashboards the backend feeds. | HTML/CSS/JS, Apps Script |
| [`infra/pi-remote`](infra/pi-remote) | A Raspberry Pi kiosk + remote that drives the office TV dashboard (Node static server, systemd units, deploy scripts). | Node (no deps), bash, systemd |
| [`design`](design) | Design references and scraped style extractions used while building the UI surfaces. Reference material, not application code. | — |
| [`docs`](docs) | System documentation: API endpoints, deployment, client-portal auth, component map, project phases. | — |
| [`data`](data) | Shared static data (team roster) referenced by the dashboards. | — |

---

## The backend in one diagram

```
        ┌──────────────── SOURCES ────────────────┐
  Follow Up Boss · IDX/MLS · Google Drive · Asana  
  Acuity · Pipeline CSVs · Lead intake (write-back) 
        └────────────────────┬─────────────────────┘
                             │  sync / ETL  (src/sync, scheduled)
                             ▼
              ┌──────────────────────────────┐
              │  SUPABASE — system of record  │
              │  Postgres tables + views      │
              │  Storage buckets (photos)     │
              └───────────────┬───────────────┘
                              │  serving + admin API (src/routes)
                              ▼
   Squarespace surfaces · admin/agent hubs · client portal · TV dashboard
```

**Why it's built this way:** every legacy "API" was a separate Apps Script hitting a third-party API on each page load. Here, sync jobs pull each source into Supabase on a schedule and the serving API reads only from Supabase, so the site is fast, resilient to upstream outages, and backed by real relational data and a photo CDN.

---

## Highlight: the AI listing-marketing agent

When a seller onboarding creates a listing, the backend enqueues a best-effort job; an out-of-band worker drafts a complete marketing package (MLS description, social captions, an email blast, a fact sheet, and a content-pillar tag) for human review. It is engineered around real production concerns:

- **Drafts only** — it never auto-publishes to the site, FUB, or MLS.
- **Idempotent + auditable** — a job table keys on an `input_hash` of the questionnaire and MLS facts, so re-submitting an unchanged form never triggers a paid re-run; every run records model, token counts, and estimated cost.
- **Grounded** — a ResearchAgent assembles only verified facts (never invents features); a CopyAgent writes strictly from those facts and the ASG brand guide.
- **Cost-capped** — a per-run token ceiling aborts the run before it can run up a bill (a single listing should never cost more than ~$1), with prompt caching on the static brand guide.

Code: [`apps/backend/src/agents`](apps/backend/src/agents), schema in `apps/backend/supabase/migrations/0017_listing_marketing_agent.sql`.

---

## Quick start (backend)

```bash
cd apps/backend
cp .env.example .env      # fill in DATABASE_URL, SUPABASE_*, source credentials
npm install
npm run db:migrate        # create schema + serving views + storage buckets
npm run db:seed           # load the team roster
npm run dev               # tsx watch; GET /health
```

Full setup, the complete endpoint contract, and deployment notes live in [`apps/backend/README.md`](apps/backend/README.md) and [`docs/`](docs).

---

## Deployment

The backend deploys to **Railway** from `apps/backend` (Nixpacks build, `npm run build` → `npm start`, health check at `/health`). The Pi kiosk is deployed over SSH/rsync from [`infra/pi-remote`](infra/pi-remote). See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
