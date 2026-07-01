# Agent Hub — PRD & Rollout Plan

Last updated: 2026-07-01
Owner: TBD (product) / Tim (eng)
Status: Living document — update as rollout progresses

## 1. Purpose

This is the third of four hub PRDs (see `docs/PLATFORM-ARCHITECTURE.md` for how all four fit together, plus `docs/CLIENT-HUB-PRD.md` and `docs/ADMIN-HUB-PRD.md`). **Agent Hub** is the personal tooling each individual ASG agent uses to run their own book of business: a personal dashboard (stats, listings, FUB deal tracker, marketing/branding links), a public lead-gen landing page, and self-serve marketing request tools.

The user's specific ask for this PRD is **deployment**: figuring out exactly what it takes to take Agent Hub from "one flagship pilot" to "every agent on the team has it." So unlike the other two PRDs, this one weights the rollout mechanics and gap-closing plan more heavily than feature ideation.

## 2. Current architectural reality (read this first)

Agent Hub today is **two disconnected generations, plus one proof-of-concept template pattern that hasn't been applied to the main product yet:**

1. **Personal hub pages** — one large, hand-written, self-contained Squarespace HTML file per agent (`agent-personal-hub-<slug>.html`), each pointing at legacy, unauthenticated Google Apps Script endpoints. This is the main "Agent Hub" product today, and it does **not scale** — every new agent requires copying and hand-editing a multi-thousand-line file.
2. **Agent-facing backend APIs** (`apps/backend/src/routes/api.ts`, `/api/portal/agent/*`) — a modern, Supabase-authenticated, session-scoped API layer that already works for *any* agent automatically once they're in the roster and signed up. **This is not wired into any personal hub page yet.** It's the foundation a real rollout should build on, but right now it's a backend with no matching frontend for agents.
3. **Agent landing pages** (public marketing pages, separate from the personal hub) — already have a working templated pattern (`agent-landing-template.html` + a Google Sheet + a `?slug=` config) proving that a shared-template approach is possible. Only Alex Stoykov's 3 pages have actually been built and launched from it so far.

**This PRD's central recommendation:** stop hand-copying personal hub HTML files, and instead build one templated Agent Hub (mirroring the landing-page template pattern) driven by the directory API and Supabase auth — the same shift Admin Hub already made with the Admin Console.

## 3. Personas

| Persona | Today | Need |
| --- | --- | --- |
| **Senior agent (11 total)** | Has a personal hub HTML file; 10 of 11 show mock/fake deal data | A working hub with their own real FUB data |
| **Junior agent (15 total)** | Has **no** personal hub, no landing page | The same tooling seniors have, without waiting for a hand-built file |
| **New hire (any tier)** | Has to be added to a roster file/sheet before they can even sign in | A single onboarding step that provisions everything (auth, hub, landing page) |
| **Ops (Tim/Ellie)** | Manually copies and edits HTML files, JSON env blobs, and sheet rows per agent | A rollout process that's mostly configuration, not code |

## 4. Current State — What's Built

### 4.1 Personal hub pages

**11 of 26 licensed agents (42%)** have a `apps/admin-hub/components/agent-personal-hub-<slug>.html` file — and all 11 are the **senior agents** (`roster.ts`); **none of the 15 junior agents have a hub page at all.**

Every hub file (all senior agents, roughly 3,400 lines each, except Alex's which is ~10,000 lines) shares the same section layout:

1. Time-of-day greeting + headshot
2. Personal stats bento (All Time / current-year tabs)
3. Team stats
4. Marketing actions (Book Marketing via Acuity, Design Request via Asana, "My Landing Page")
5. Deal Tracker (FUB-powered deal cards, search, detail drawer)
6. My Listings (active/closed)
7. Events & Updates feed
8. Agent branding (marketing drive, guides, listing presentation, business card)
9. Quick-link resources
10. A usage-tracking beacon

**Only Alex Stoykov's page is production-grade.** The other 10 senior agents' hub files are **staged copies with the real Follow Up Boss integration deliberately disabled**: a `DT_PREVIEW_USE_MOCK_DATA = true` flag shows a red "Mock Data" chip and renders fake, hardcoded deal cards instead of calling the live FUB API. Alex's page also has an inline full listings workspace and a newer listings API deployment that the other 10 don't have. In other words: **these 10 files are not an outdated template — they're the same generation, mid-rollout, just not switched on yet.**

Every hub file hardcodes, per agent: the DOM root ID and every CSS selector, the `AGENT_PROFILE` object (name, tier, email, phone, photo, landing URL, Acuity book URL, Asana request-form URL), the FUB display-name used for matching (`FUB_AGENT_NAME`), a marketing Drive-folder search string, and the usage-beacon's agent email/name. **There is no shared template file** — each is an independent copy.

**Net:** hub HTML coverage is 11/26 (42%), and production-quality (live FUB, no mock flag) is 1/26 (~4%).

### 4.2 Agent landing pages (public marketing/lead-gen, separate track)

This is the one part of Agent Hub that already proves the templated approach works:

- `agent-landing-template.html` is a **single reusable file** that reads `window.ASG_AGENT_LANDING_CONFIG.slug` and `.page`, calls the landing API (`?view=agent&slug=...&page=...`), and renders that agent's profile/stats/reviews.
- The content itself lives in a Google Sheet workbook (`Agents`, `Stats`, `Reviews`, `PageSections`, `IDXConfig`, `ListingsCurated` tabs) — adding a new agent's landing page is mostly a **spreadsheet + Squarespace page** exercise, not a code change.
- `apps/admin-hub/components/agent-landing-rollout-guide.md` documents the exact process: add sheet rows → duplicate 3 Squarespace pages (general/buyer/seller) → set two config globals → paste the template → run a QA checklist.
- **Rollout status: only Alex Stoykov has launched pages** (3 of them, and his are actually bespoke full files rather than the generic template, per the explore — a hybrid state). Every other agent is still at the "template exists, sheet rows not yet added" stage.

### 4.3 Backend agent-facing APIs

Two parallel API generations exist, and only the older one is actually used by today's hub pages:

| Generation | Routes | Auth | Scoping | Used by hub HTML today? |
| --- | --- | --- | --- | --- |
| **Legacy (Apps Script proxy via Railway)** | `GET /api/fub-hub` (+`?view=dealTracker`, `?view=schema`) | None | Caller passes `agentEmail`/`agentName` as query params — works for any agent, but anyone can query anyone's data | **Yes** — every existing hub file still points here |
| **Modern (Supabase-authenticated portal)** | `GET /api/portal/agent/hub`, `/deal-tracker`, `/marketing`; `POST /api/portal/agent/marketing`, `/listings/:id/requests` | Bearer session, `requireAgent` | Scoped automatically from the signed-in agent's own profile — no query params, no way to see another agent's data | **No** — not wired into any personal hub page yet |

The modern portal routes are the better foundation: they're **agent-agnostic by construction** (any agent who signs in gets their own data, zero per-agent code), whereas the legacy routes are agent-agnostic in principle but rely on the caller supplying the right email/name and have no access control. Pipeline stats (`/api/pipeline-stats`) and listings (`/api/listings`) are similarly already "any agent" ready — the hub HTML just filters client-side by agent name.

**The actual bottleneck for FUB/stats data isn't the backend — it's data hygiene.** Deals used to be matched to an agent purely by comparing a free-text name field against the roster's `name` field (exact, case-insensitive); any nickname or spelling mismatch (e.g. "Sam Abadi" vs. "Samuel Abadi") silently produced an empty deal tracker or missing stats for that agent, with no error. `sync/fub.ts` now matches by FUB user id first (via the deal's own assignment, then its contact's already-id-matched agent) and only falls back to the old text match as a last resort — see the P0 note in §8 — but the underlying cause, an agent's FUB account email not matching their `agents` row, is a data problem only a human can fix; `npm run roster:data-quality` surfaces exactly who's affected.

### 4.4 Roster & directory (who counts as "an agent")

There are **three places an agent's identity can live**, and they don't automatically reconcile:

1. **`apps/backend/src/data/roster.ts`** — a hardcoded TypeScript array (11 senior + ~14–15 junior + 5 admin). A daily cron (`syncDirectory`) upserts this into the `agents` Postgres table and enriches it with the agent's FUB user ID by email match. It does **not** deactivate agents removed from the file.
2. **The `agents` Postgres table via `POST /api/admin/directory`** — a richer bulk-upsert from a Google Sheet (headshots, bios, landing URLs, branding asset links), which **is** documented as the source of truth and **can** deactivate agents missing from the sheet.
3. **`team-directory.html`'s hardcoded `TEAM` array** (used by the Admin Console's Team Directory tab) — the most complete *marketing* roster (35 people), but it includes at least 4 people who aren't in `roster.ts`, and roughly two dozen agents have placeholder `"#"` links for their Asana request form or landing page.

**Why this matters for rollout:** signing up as an `agent` in Supabase requires the person's email to already exist in the `agents` table — so **onboarding a new agent always starts with a roster/sheet edit**, before anything else can happen. Today that step can come from either of two different mechanisms, and they can drift out of sync with each other and with the marketing-facing directory.

### 4.5 Per-agent configuration required in environment variables

Two Asana integrations require a **manual JSON entry per agent** in a Railway environment variable (discoverable via `npm run asana:inspect`):

- `ASANA_AGENT_PORTFOLIOS_JSON` — routes that agent's new listing Asana projects into their personal portfolio. Missing an entry just means the project stays in the team portfolio only — not a hard failure.
- `ASANA_AGENT_REQUEST_PROJECTS_JSON` — mirrors that agent's self-serve marketing requests into their own "Requests - `<Agent>`" Asana project. Missing an entry means the request still works (Supabase is the system of record) but doesn't show up in Asana for whoever's tracking it there.

Neither is a hard blocker to an agent using the product, but both need to be kept in sync as agents are added — 2 JSON maps × 26+ agents if done for everyone.

### 4.6 Agent onboarding checklist

`apps/admin-hub/components/agent-onboarding.html` is a static, unwired admin-facing checklist (intake form fields + a launch checklist + a "first 30 days" plan). It mentions landing pages and CRM setup, but **has no line item for provisioning a personal hub page, adding the agent to the roster, or wiring FUB/Asana identifiers** — the actual hub-launch steps are tribal knowledge, not tracked anywhere.

### 4.7 New requirement: self-serve agent onboarding wizard

This is a new product requirement, not yet built: **an agent should be able to create their own account with their Compass email, go through an onboarding wizard that collects their information, and land on a working personal hub immediately** — with no one hand-building an HTML file or manually editing an `AGENT_PROFILE` constant for them.

**Proposed flow:**

1. Agent signs up with `name@compass.com`. The existing roster gate (email must already exist in the `agents` table, per `auth.ts`) still applies as the "is this really one of ours" check — but see the dependency note below, since today adding that roster row is itself a manual step.
2. On first login, if the agent hasn't completed onboarding (a `portal_onboarding_completed`-style flag, mirroring the pattern the Client Hub portal already uses for buyer/seller onboarding), they're routed into a **wizard** instead of a blank or missing hub: headshot upload, short bio, license number, market focus/neighborhoods, social links, preferred branding assets, their Acuity booking link, notification preferences.
3. Wizard submit writes directly into the `agents` table in Supabase — no Google Sheet round-trip required for this path (the sheet can remain a bulk-import/admin-edit option in parallel).
4. Agent is redirected straight to their working hub, rendered from live data — **not** a new hand-copied HTML file.

**Hard dependency — read this before scoping the wizard:** step 4 only works once the **templated Agent Hub** (this PRD's own P1 recommendation, §8) exists. Building this wizard on top of today's copy-per-agent HTML files would just add a fourth manual step (wizard data entry) on top of the three that already exist (roster edit, HTML copy, Squarespace paste) — it would not remove any existing toil. The wizard and the templated hub should ship together, or the wizard should ship second.

Full cross-hub framing (including the parallel admin-onboarding flow and how this interacts with Supabase as the single source of truth) is in `docs/PLATFORM-ARCHITECTURE.md` §5.1.

## 5. The Rollout Gap

| Metric | Today | Target |
| --- | --- | --- |
| Agents with a personal hub HTML file | 11 / 26 (42%) | 26 / 26 |
| Agents with a hub on **live** FUB data (not mock) | 1 / 26 (~4%) | 26 / 26 |
| Agents with a launched landing page | 1 / 26 (~4%, and it's a bespoke build, not the generic template) | 26 / 26 via the shared template |
| Backend agent-agnostic API readiness | Fully ready (`/api/portal/agent/*`) | No change needed — just needs a frontend |
| Roster sources that must agree | 3 (`roster.ts`, Sheet → `agents` table, `team-directory.html`) — the first two no longer fight over the same row (see §8 P0), `team-directory.html` still drifts | 1 canonical source everywhere |

## 6. Mechanical Rollout Classification

For planning purposes, every capability below is tagged:
- **(a) Automatic** — works for any agent the moment they're in the roster/signed up, no extra step
- **(b) One-time config** — a spreadsheet row or an environment variable entry, no code
- **(c) Manual build** — someone has to write/copy/edit a file

| Capability | Class | Exact step needed per agent |
| --- | --- | --- |
| Supabase account + `role = agent` | (b) | Add the agent's email to the roster (Sheet row, or `roster.ts` + directory sync) before they can sign up |
| FUB hub data + deal tracker (backend) | (a) | None, once FUB user email and deal `agentName` match the roster name |
| Portal routes (`/api/portal/agent/*`) | (a) | None, once signed up — but nothing consumes these routes yet (see §4.3) |
| Pipeline stats on a hub | (a) | None, contingent on the same name-matching |
| Marketing self-serve (database-backed) | (a) | None, once signed up |
| Marketing → Asana mirror | (b) | Add email to `ASANA_AGENT_REQUEST_PROJECTS_JSON` |
| Listing → agent's Asana portfolio | (b) | Add email to `ASANA_AGENT_PORTFOLIOS_JSON` |
| Personal hub HTML page | (c) | Copy an existing hub file, rewrite every hardcoded field and CSS selector, flip the mock-data flag off, paste into a new Squarespace page |
| Landing page | (b)/(c) hybrid | Add sheet rows for the generic template (b) — or hand-build a bespoke file like Alex's (c) |
| Usage/adoption attribution | (c) | Set the agent's email/name inside the hub file's beacon block (already present in all 11 existing files, just per-file) |
| Admin role (ops staff) | (b) | Manual SQL update — not self-service for anyone |

**Read straight through, this is the finding that should drive the roadmap:** everything backend-side is already (a) automatic. Every real bottleneck is a **(c) manual file** — the personal hub HTML and, to a lesser extent, a bespoke landing page.

## 7. Gaps & Risks

- **No shared hub template.** Unlike landing pages, personal hubs have no `?slug=`-driven renderer — every rollout step is a multi-thousand-line copy-paste-and-edit. This is the single biggest reason coverage is stuck at 42%.
- **10 of 11 existing hub pages show fake data to real agents.** The mock-data flag was clearly meant as a staging step, but there's no tracked plan or owner for flipping it off agent-by-agent.
- **Silent data-quality failures.** Name-matching between FUB and the roster has no validation step — an agent can go live with an empty deal tracker and nobody gets an error, they just look inactive.
- **Three roster sources can drift.** `roster.ts`, the Google Sheet-backed `agents` table sync, and `team-directory.html`'s hardcoded array aren't reconciled, so "is this agent fully onboarded" doesn't have one clear answer today.
- **Modern backend, no modern frontend.** The `/api/portal/agent/*` routes — the actually scalable, secure, per-agent-config-free option — aren't used by a single hub page yet. Continuing to build on the legacy Apps Script pattern just deepens the (c) manual-build problem.
- **15 junior agents are fully excluded** from both the personal hub and the landing page product today, with no page, no plan, and no line item in the onboarding checklist.
- **Onboarding checklist doesn't mention any of this.** `agent-onboarding.html` has zero line items for roster entry, hub provisioning, FUB/Asana identifier setup, or landing page creation — so hub rollout depends entirely on someone remembering to do it.

## 8. What's Left to Build — Prioritized Roadmap

### P0 — Stop the bleeding on what already exists
1. **✅ Shipped:** deal→agent matching no longer relies on a single brittle name-text comparison. `sync/fub.ts` now cascades through (a) the deal's own FUB user id, (b) its primary contact's already-id-matched agent, and only then (c) a case-insensitive name match — and reports how many deals still end up unmatched via `SyncResult.meta.agentMatch` (visible in `sync_runs`). Run `npm run roster:data-quality` (new, read-only) after `npm run sync:fub` to see exactly which agents/deals still need a human fix (typo'd email, missing FUB account, etc.) — it cannot fix the underlying business data, only surface it.
2. **Flip the mock-data flag off** for the 10 senior agents who already have real hub files, once `roster:data-quality` shows their FUB match is clean — this alone takes production-grade FUB coverage from 1/26 to 11/26 with no new code.
3. **✅ Shipped:** picked the Google Sheet path (`POST /api/admin/directory`) as the one roster source of truth. `sync/directory.ts`'s daily `roster.ts`-based cron is now guarded (`where agents.directory_synced_at is null`) so it only ever seeds an agent who hasn't gone through the sheet yet, and can never again silently overwrite a sheet-edited row. `team-directory.html`'s hardcoded array is still a separate drift risk (§4.4) — not fixed by this change, still open.

### P1 — Build the thing that actually scales
1. **Build a templated Agent Hub** — one HTML/JS renderer that takes an agent slug (from the URL, from a Squarespace page setting, or better, from the signed-in Supabase session) and pulls profile, stats, listings, and deal data from `/api/hub-data` and `/api/portal/agent/*` instead of hardcoded per-file constants. This mirrors the pattern that already works for landing pages.
2. **Migrate off the legacy `/api/fub-hub` query-param API** to the authenticated `/api/portal/agent/*` routes as part of that same build — this closes the "anyone can query anyone's FUB data" gap for free.
3. **Build the self-serve onboarding wizard** (§4.7) on top of the templated hub from step 1 — this is what actually lets a new agent go from "just hired" to "using their hub" without anyone hand-building anything.
4. **Add hub-launch line items to `agent-onboarding.html`**: for whatever the wizard doesn't cover (license/compliance verification, admin-side roster approval), so rollout stops depending on memory even for the parts that stay manual.

### P2 — Close the coverage gap
1. Once the template exists, provision hub pages for the **15 junior agents** who currently have none — this should now be a config/sheet-row exercise, not 15 more multi-thousand-line files.
2. Roll landing pages out to all agents through the existing sheet-driven template (already proven on the mechanism side; just needs the content work).
3. Backfill `ASANA_AGENT_PORTFOLIOS_JSON` and `ASANA_AGENT_REQUEST_PROJECTS_JSON` for every agent (or automate discovery/generation of these maps via the existing `asana:inspect` tool instead of hand-editing JSON).
4. Standardize usage-beacon attribution so adoption tracking works automatically from the templated hub rather than per-file hardcoding.

### P3 — Depth once everyone's on the same platform
1. Bring deal-workflow checklist edits (currently split between `localStorage` in some legacy surfaces and real persistence via `/api/admin/deal-workflow`) fully onto the authenticated portal path for agents too.
2. Consider merging the "personal hub" and "landing page" config into one per-agent record instead of two separate systems (directory `agents` row + landing Sheet row).
3. Add agent-level adoption/engagement reporting to the Admin Console's Command Center (already scaffolded there per `docs/ADMIN-HUB-PRD.md`) once beacon attribution is consistent.

## 9. Open Product Decisions

- [ ] Is building a single templated Agent Hub (P1) worth pausing new per-agent hub copies in the meantime, or should the 15 juniors get legacy-style copied files now while the template is built in parallel?
- [ ] Which roster source wins — the Google Sheet (`/api/admin/directory`) or `roster.ts`? Recommend picking one before onboarding the next new hire.
- [ ] Should junior agents get the full hub feature set (inline listings workspace, FUB deal tracker) at parity with seniors, or a lighter version to start?
- [ ] Who owns flipping each senior agent's mock-data flag off, and validating their FUB name match before doing so?
- [ ] Should landing pages move fully to the generic template (dropping Alex's bespoke build), or does the bespoke pattern stay as an option for high-priority agents?
- [ ] Is per-agent Asana mirroring (portfolios + request projects) worth the ongoing manual upkeep, or should it be deprioritized/automated given it's not required for the core product to work?

## 10. Success Metrics (proposed)

| Metric | Why it matters |
| --- | --- |
| % of agents with a hub on live (non-mock) data | Direct measure of rollout completion |
| % of agents with zero deals/stats due to name-mismatch | Data-quality health, should trend to 0 |
| % of agents with a launched landing page | Lead-gen rollout completion |
| Time from "added to roster" to "hub + landing page live" | Onboarding efficiency once templated |
| Number of roster-source discrepancies found per audit | Whether the single-source-of-truth decision is holding |
| Hub adoption (page views/clicks via usage beacon) per agent | Whether agents actually use what's built for them |

## 11. Appendix — File & Route Inventory

### Personal hub pages (11 exist, all senior agents)

`apps/admin-hub/components/agent-personal-hub-{alex-stoykov, angela-engelbrecht, barbara-laken, gabriel-rendon, julian-levit, layne-zagorin, matthew-clevenger, mino-conenna, nicolas-gamboa-wills, sam-abadi, shelly-channey}.html`

Alex Stoykov's is the only one with the mock-data flag off and an inline listings workspace. No `agent-personal-hub-template.html` exists.

### Landing pages

| File | Status |
| --- | --- |
| `agent-landing-template.html` | Generic sheet-driven renderer — the pattern to copy for personal hubs |
| `agent-landing-alex-stoykov-{general,buyer,seller}.html` | Launched, but bespoke rather than template-driven |
| `agent-landing-rollout-guide.md` | Documented rollout playbook (sheet rows → Squarespace pages → QA) |

### Roster / directory sources

| Source | Location | Role |
| --- | --- | --- |
| `apps/backend/src/data/roster.ts` | Hardcoded TS array | Seeds `agents` table via daily cron |
| Google Sheet → `POST /api/admin/directory` | External sheet | Documented source of truth; supports deactivation |
| `team-directory.html`'s `TEAM` array | Hardcoded in Admin Console file | Marketing-facing roster, drifts from the other two |

### Data-quality tooling

| Tool | What it does |
| --- | --- |
| `npm run roster:data-quality` | Read-only CLI (`apps/backend/src/tools/rosterDataQuality.ts`) — lists agents with no matching FUB user (email mismatch), FUB users with no matching agent, and deals still unmatched after `sync:fub`'s id/contact/name cascade. Run after `npm run sync:fub`. |

### Backend routes

| Generation | Routes |
| --- | --- |
| Legacy (unauthenticated, still used by hub HTML) | `GET /api/fub-hub[?view=dealTracker\|schema]`, `POST /api/fub-hub/deal-workflow` (secret-gated) |
| Modern (authenticated, not yet wired to any UI) | `GET /api/portal/agent/hub`, `GET /api/portal/agent/deal-tracker`, `GET/POST /api/portal/agent/marketing`, `POST /api/portal/agent/listings/:id/requests` |
| Shared, agent-agnostic reads | `GET /api/pipeline-stats`, `GET /api/listings`, `GET /api/hub-data` |

### Related docs

- `docs/API-ENDPOINTS.md` — "Follow Up Boss Agent Hub API (Pilot)" section, still Apps-Script-era rollout instructions
- `docs/PROJECT-PHASES-AND-PERFORMANCE.md` — Phase 7 (Agent Personal Hubs) and open decision on a shared generator/template
- `apps/admin-hub/components/agent-landing-rollout-guide.md` — the template pattern to reuse for personal hubs
- `docs/PLATFORM-ARCHITECTURE.md` — how this hub fits with Client Hub, Admin Hub, and Orchestration Hub, and the cross-cutting onboarding-wizard spec (§5.1)
- `docs/FUB-DATA-STANDARDS.md` — team-facing checklist of what to keep current in FUB so hubs/reports actually populate; hand this to agents, don't make them read this PRD
- `docs/ADMIN-HUB-PRD.md`, `docs/CLIENT-HUB-PRD.md` — the other two active hub PRDs
