# ASG Backend

A unified backend for the **Alex Stoykov Group**. It makes **Supabase (Postgres + Storage)** the single system of record, **ingests every existing endpoint** (Follow Up Boss, IDX/MLS, Google Drive photos, Asana, Acuity, published pipeline CSVs), and **serves every ASG UI surface** through one HTTP API that reproduces the current Apps Script contracts.

```
                 ┌──────────── SOURCES ────────────┐
  Follow Up Boss │ IDX/MLS │ Google Drive │ Asana   │
  Acuity │ Pipeline CSVs │ Lead intake (write-back) │
                 └───────────────┬─────────────────┘
                                 │  sync / ETL  (src/sync)
                                 ▼
                    ┌────────────────────────────┐
                    │   SUPABASE (system of record)│
                    │  Postgres tables + views     │
                    │  Storage buckets (photos)    │
                    └─────────────┬────────────────┘
                                  │  serving API (src/routes)
                                  ▼
        Squarespace surfaces · admin hubs · agent hubs · TV dashboard
```

Why this design: today every "API" is a separate Google Apps Script hitting a live
third-party API on each request. Here, **sync jobs** pull each source into Supabase on
a schedule, and the **serving API** reads only from Supabase — so the website is fast,
resilient to upstream outages, and backed by real relational data and a photo CDN.

---

## What it does

### Ingests (merges into Supabase)
| Source | Job | Lands in |
|---|---|---|
| Follow Up Boss (people, deals, tasks, notes, appointments, pipelines, stages, custom fields) | `fub` | `contacts`, `deals`, `tasks`, `notes`, `appointments`, `external_cache` |
| IDX Broker / Elm Street (featured + soldpending + supplemental) | `idx` | `idx_listings`, `listing_photos` (source `idx`) |
| Google Drive listing photos | `photos` | **Supabase Storage** + `listing_photos` (source `drive`) |
| Google Drive recent folders | `drive-folders` | `drive_folders` |
| Asana marketing tasks | `marketing` | `asana_tasks` |
| Acuity bookings | `marketing` | `acuity_appointments` |
| Pipeline CSVs (buyers/sellers) | `pipeline` | `pipeline_deals` + `agent_stats` |
| Team roster | `directory` | `agents` |
| Buyer/Seller onboarding | (live `POST /api/intake`) | `leads` → also written back to FUB |

**Photos** are downloaded from Drive (and optionally from the IDX CDN with
`--mirror-idx`), uploaded into the public `listing-photos` Storage bucket, and recorded
in `listing_photos` with their Supabase CDN URLs. The website renders straight from
Supabase instead of Google Drive.

### Accounts & client portal (Supabase Auth, same database)
User accounts live in Supabase Auth (`auth.users`) inside the **same Postgres** as
everything else. A `profiles` row (created automatically on signup) gives each user a
role and links them to the rest of the data:

| Role | How it's assigned | Sees |
|---|---|---|
| `client` | any non-Compass email | only their own deals, deal progress, appointments, and saved onboarding drafts |
| `agent` | **must** sign up with their `name@compass.com` roster email | their own assigned book (contacts, deals, deal tracker) |
| `admin` | set manually on a profile | everything |

- **Agent gating**: a `handle_new_user()` trigger on `auth.users` rejects any `@compass.com`
  signup that isn't on the `agents` roster, and auto-links matched agents. Non-Compass
  emails become clients. So agents can only ever log in with their roster Compass email.
- **Client portal**: clients are linked to their `contacts` row (by email), and through it
  to their `deals`. `GET /api/portal/deals` returns a client-safe progress view
  (milestone timeline + % complete derived from the deal workflow checklist) — internal
  notes/tasks are excluded.
- **Saved onboarding**: `onboarding_drafts` stores partial buyer/seller wizard state per
  user so they can resume; submitting finalizes the lead into Follow Up Boss.
- **Defense in depth**: Row Level Security policies enforce all of the above at the
  database level (so even direct `supabase-js` browser access is scoped), and the API
  endpoints re-scope by the verified user's profile.

Auth/portal endpoints:

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/auth/signup` | — | create account (`email`, `password`, `fullName`) |
| `POST /api/auth/login` | — | password login → returns Supabase session tokens |
| `GET /api/auth/me` | Bearer | current profile (role, linked agent/contact) |
| `GET /api/portal/deals` | client | the client's deals with progress milestones |
| `GET/PUT /api/portal/onboarding/:formType` | any | load / save onboarding draft |
| `POST /api/portal/onboarding/:formType/submit` | any | finalize draft → FUB lead |
| `GET /api/portal/agent/hub` | agent | the agent's own contacts/deals/tasks |
| `GET /api/portal/agent/deal-tracker` | agent | the agent's own under-contract deals |

Browsers may also use `supabase-js` directly for signup/login/password-reset/magic-link
(set `SUPABASE_ANON_KEY`); then send the access token as `Authorization: Bearer <token>`
to the portal endpoints above.

### Serves (feeds the UI)
Every route returns the **same JSON shape** the current surfaces already consume, so
cutover is a one-line base-URL change per page.

| New endpoint | Replaces | Used by |
|---|---|---|
| `GET /api/listings?view=home\|active\|archive\|all\|listing\|listingphotos\|idxsync` | Listings V1/V2 + Listing Hub | homepage, search-homes, listing-details, admin/agent hubs |
| `GET /api/photos?address=…` | Listing Hub `?view=listingphotos` | listing-details, agent hub Listing HQ |
| `GET /api/pipeline-stats?period=…` / `?view=pipeline` | Pipeline Stats | admin dashboard, TV dashboard, agent hubs |
| `GET /api/fub-hub?agentEmail=…` / `?view=dealTracker` / `?view=schema` | FUB Agent Hub + Deal Tracker | agent hubs, deal-tracker |
| `POST /api/fub-hub/deal-workflow` | (new) Deal Tracker write-back | deal-tracker |
| `GET /api/command-center?view=…&period=…` | Command Center aggregator | command-center |
| `GET /api/hub-data?view=…` | Hub Data | team directory, hubs, landing pages |
| `POST /api/usage-log` · `GET /api/usage-log` | Usage Log | usage beacon on every hub |
| `GET /api/recent-folders` | Recent Folders | admin dashboard, marketing-assets |
| `GET /api/marketing-output?days=…` | Marketing Output | marketing-output-tracker |
| `POST /api/intake` | Buyer/Seller Intake | buyer/seller onboarding wizards |
| `POST /api/sync/:job` | (new, secured) trigger a sync | ops / webhooks |
| `GET /health` | (new) health + source readiness | monitoring |

### Writes back (admin/staff edit Supabase from the dashboards)
The live UI is read-only today. These endpoints let the dashboards push edits **back**
into Supabase once they can authenticate — no UI change is required to deploy them; you
wire the dashboards to them when you're ready.

**Authorization** — every `/api/admin/*` route accepts either credential:
1. **`X-Asg-Secret: <WEBHOOK_SECRET>`** — trusted server-to-server / your own admin tool
   (curl, Postman, a private script). Treated as admin. Use this to start writing *now*.
2. **`Authorization: Bearer <supabase access token>`** whose profile role is `admin`
   (or `agent` where noted). This is the path the public dashboards use once an admin
   login is added — never put `WEBHOOK_SECRET` in browser JS.

> Because the admin hubs are public Squarespace pages, real browser writes must go through
> an admin **login** (option 2), not a baked-in secret. RLS policies (migration `0010`)
> additionally scope any direct `supabase-js` writes: admins write everything; agents write
> only their own listings and assigned deals.

| Endpoint | Role | Purpose |
|---|---|---|
| `POST /api/admin/listings` | admin/agent | create a listing (loose values like `"$1.25M"`, `"yes"`, `"3/4/2026"` are coerced) |
| `PATCH /api/admin/listings/:id` | admin/agent | update any listing field |
| `POST /api/admin/listings/:id/archive` | admin/agent | `{archived:true\|false}` |
| `POST /api/admin/listings/:id/cover` | admin/agent | `{url}` set cover image |
| `POST /api/admin/listings/:id/photos` | admin/agent | add photo — `{base64,contentType,filename}` (uploads to Storage) or `{url}` |
| `DELETE /api/admin/photos/:photoId` | admin/agent | remove a photo (and its Storage object) |
| `DELETE /api/admin/listings/:id` | admin | delete a listing |
| `POST /api/admin/deal-workflow` | admin/agent | upsert Deal Tracker workflow (`dealId` + checklist/earnest/dates) |
| `POST /api/admin/agents` · `PATCH /api/admin/agents/:id` | admin | create / edit a directory agent |
| `POST /api/admin/agents/:id/active` · `/headshot` | admin | (de)activate · upload headshot (`base64`) |
| `POST /api/admin/events` · `PATCH/DELETE /api/admin/events/:id` | admin | team calendar |
| `POST /api/admin/updates` · `PATCH/DELETE /api/admin/updates/:id` | admin | team announcements |
| `GET /api/admin/leads` · `PATCH /api/admin/leads/:id` | admin | triage / assign onboarding leads |
| `PUT /api/admin/landing/:slug/:pageType` | admin | upsert a landing-page config |

```bash
# write now, from a trusted context, with the shared secret:
curl -X PATCH https://api.alexstoykovgroup.com/api/admin/listings/<id> \
  -H 'Content-Type: application/json' -H "X-Asg-Secret: $WEBHOOK_SECRET" \
  -d '{"status":"Under Contract","phaseKey":"underContract"}'

# later, from a logged-in admin dashboard:
#   Authorization: Bearer <supabase access token>   (role = admin)
```

---

## Setup

### 1. Create the Supabase project
Create a project at supabase.com, then grab from **Project Settings**:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (API)
- `DATABASE_URL` (Database → Connection string → URI)

### 2. Configure env
```bash
cd backend
cp .env.example .env
# fill in DATABASE_URL, SUPABASE_*, and whichever source credentials you have
npm install
```

### 3. Run migrations
Either with the Supabase CLI (recommended) or the built-in runner:
```bash
# option A — Supabase CLI
supabase db push          # applies supabase/migrations/*.sql

# option B — self-migrate against DATABASE_URL
npm run db:migrate
```
This creates every table, the `listings_enriched` serving view, the three Storage
buckets (`listing-photos`, `headshots`, `brand-assets`), and the accounts layer
(`profiles`, `onboarding_drafts`, RLS policies, and the `@compass.com` agent-gating
trigger). The accounts migration (`0009`) requires the Supabase `auth` schema; it is a
safe no-op on a plain Postgres.

> Promote an admin once: `update profiles set role = 'admin' where email = 'you@compass.com';`

### 4. Seed + first sync
```bash
npm run db:seed        # load the team roster into `agents`
npm run sync:all       # pull every configured source into Supabase
# photo mirror + IDX CDN copy:
npm run sync:photos -- --mirror-idx
```

### 5. Run the API
```bash
npm run dev            # tsx watch (development)
# or
npm run build && npm start
curl localhost:8787/health
```

### 6. Keep it in sync
Set `ENABLE_SCHEDULER=true` to run cron syncs inside the API process, **or** run the CLI
from an external scheduler (cron, GitHub Actions, Supabase scheduled function, etc.):
```bash
npm run sync:idx        # every 15 min
npm run sync:fub        # every 30 min
npm run sync:photos     # hourly
npm run sync:pipeline   # every 30 min
npm run sync:directory  # daily
npm run sync:marketing  # every 30 min
```
You can also trigger remotely: `POST /api/sync/idx` with header `X-Asg-Secret: <WEBHOOK_SECRET>`.

---

## Wiring the UI surfaces

Each Squarespace component reads its endpoint from a `window.*` constant. Point those at
this backend and the existing code keeps working:

```html
<script>
  window.ASG_LISTINGS_API       = 'https://api.alexstoykovgroup.com/api/listings';
  window.ASG_PHOTOS_API         = 'https://api.alexstoykovgroup.com/api/photos';
  window.ASG_PIPELINE_STATS_API = 'https://api.alexstoykovgroup.com/api/pipeline-stats';
  window.FUB_HUB_API            = 'https://api.alexstoykovgroup.com/api/fub-hub';
  window.DEAL_TRACKER_API       = 'https://api.alexstoykovgroup.com/api/fub-hub?view=dealTracker';
  window.ASG_COMMAND_CENTER_API = 'https://api.alexstoykovgroup.com/api/command-center';
  window.ASG_HUB_DATA_API       = 'https://api.alexstoykovgroup.com/api/hub-data';
  window.ASG_USAGE_LOG_API      = 'https://api.alexstoykovgroup.com/api/usage-log';
  window.ASG_RECENT_FOLDERS_API = 'https://api.alexstoykovgroup.com/api/recent-folders';
  window.ASG_MARKETING_OUTPUT_API = 'https://api.alexstoykovgroup.com/api/marketing-output';
  window.ASG_BUYER_INTAKE_API   = 'https://api.alexstoykovgroup.com/api/intake';
  window.ASG_SELLER_INTAKE_API  = 'https://api.alexstoykovgroup.com/api/intake';
  window.ASG_LEAD_ENDPOINT      = 'https://api.alexstoykovgroup.com/api/intake';
</script>
```

The intake endpoint accepts both buyer and seller payloads (it dispatches on
`_formType`, just like the current Apps Script). Unlike `no-cors` Apps Script, this API
returns CORS headers, so the wizards can read the real success response.

---

## Project layout
```
backend/
  supabase/migrations/   SQL schema (tables, views, storage buckets)
  src/
    env.ts               typed env + per-source readiness flags
    db/                  postgres client, migrate, seed
    storage.ts           Supabase Storage upload helpers
    connectors/          fub · idx · drive · asana · acuity · sheets
    sync/                ETL jobs + orchestrator + CLI
    repositories/        DB → API response shaping (listings, crm, pipeline, admin, …)
    routes/api.ts        Fastify routes (the serving + portal contract)
    routes/admin.ts      Fastify routes (admin/staff write-back API)
    auth.ts              Supabase Auth verification + requireAuth/Agent/Write
    scheduler.ts         in-process cron
    index.ts             server bootstrap
```

## Notes & trade-offs
- **Partial configuration works.** Every source is optional; `sync:all` and the scheduler
  skip sources without credentials. The serving API degrades gracefully (empty arrays).
- **Stack choice.** Node 18+ / Fastify / TypeScript with direct Postgres access (so the
  `listings_enriched` merge view and multi-table joins are simple). Supabase Storage is
  used via the service-role key. An Edge Functions deployment is possible later but a
  long-running Node service is better suited to the Drive photo pipeline and schedulers.
- **`agent_stats`** is currently snapshotted from synced FUB deals. If you publish the
  "ASG Deals" workbook tabs as CSV, point a CSV importer at them in `sync/pipeline.ts`.
- **Security.** The service-role key and `DATABASE_URL` are server-only. Sync endpoints
  and the admin write API require either the `WEBHOOK_SECRET` (server-to-server) or a
  logged-in admin/agent Supabase token; RLS is the database-level backstop. Storage
  buckets are public-read for the website. Base64 uploads raise the body limit to 30 MB.
```
