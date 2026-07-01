# Admin Hub — PRD & Build Status

Last updated: 2026-07-01
Owner: TBD (product) / Tim (eng)
Status: Living document — update as surfaces ship or scope changes

## 1. Purpose

This is the second of four hub PRDs (see `docs/PLATFORM-ARCHITECTURE.md` for how all four fit together). It covers the **Admin Hub**: internal tooling for ops and leadership (Tim, Ellie, Alex, TC, and any future ops hires) to run listings, marketing, deals, and the team roster. It's distinct from:

- **Agent Hub** — agent-only surfaces (personal hub pages, FUB deal tracker for one agent's own book, agent self-serve marketing requests). See `docs/AGENT-HUB-PRD.md`.
- **Client Hub** — public site, onboarding, client portal. Already documented in `docs/CLIENT-HUB-PRD.md`.
- **Orchestration Hub** — sole-engineer-only system/security/DB visibility, backlog. See `docs/ORCHESTRATION-HUB-PRD.md`.

Where an Admin Hub feature is really "the admin-side of a shared system" (e.g. marketing task status that also appears in the client portal, or agent self-serve routes that share a UI file with the admin view), this doc notes the connection but the detailed client/agent-side behavior lives in the other PRDs.

## 2. Current architectural reality (read this first)

Unlike Client Hub, which is mostly one clear generation of pages, **Admin Hub is mid-migration**. There are two generations of admin tooling live in the repo at once:

1. **Legacy stacked Squarespace blocks** — a set of independent, large, self-contained HTML files (`admin-dashboard.html`, `admin-master-dashboard.html`, `marketing-assets.html`, `team-directory.html`, `agent-cards.html`, etc.), each pasted into its own Code Block on the `/adminhub` page, all backed mostly by legacy Google Apps Script endpoints and Google Sheets. This is what `docs/COMPONENT-MAP.md` and `docs/DEPLOYMENT.md` describe.
2. **The new unified Admin Console** (`apps/admin-hub/components/asg-admin-console.html`) — a single generated Squarespace code block with real Supabase auth, a tabbed nav shell, and a Railway/Postgres backend (`apps/backend`). This is the active direction and where new feature work (marketing workload) is landing.

**This PRD treats the Admin Console as the intended production surface** and calls out legacy files as either "embedded into the console" (still relevant) or "superseded" (candidate for retirement) — but the docs and even the Squarespace deploy target have not yet been fully cut over, which is itself the top open decision in §8.

## 3. Personas

| Persona | Primary need |
| --- | --- |
| **Broker/owner (Alex)** | High-level pipeline, team performance, marketing velocity |
| **Ops lead (Tim)** | Listing workshop operations, marketing task assignment, system health, Asana/Acuity plumbing |
| **Marketing coordinator (Ellie)** | See every open marketing request/task across agents, mark work delivered, keep listings' asset status accurate |
| **Transaction coordinator (TC)** | Deal checklist tracking, earnest money tracking, closing milestones |
| **Future admin hires** | Same as above; currently no self-service way to provision a new admin account (see gaps) |

## 4. Current State — What's Built

### 4.1 The Admin Console shell

`apps/admin-hub/components/asg-admin-console.html` is **generated**, not hand-written. The build pipeline:

```
apps/admin-hub/tools/console-body.html   (shell markup + <!--SURFACE:*--> placeholders)
apps/admin-hub/tools/console-config.js   (window.ASG_* API base + Supabase config)
apps/admin-hub/tools/console-shell.css   (visual system: glass nav, bento FAB modal)
apps/admin-hub/tools/console-app.js      (auth, routing, ASGConsole bridge)
        +
apps/admin-hub/components/admin-dashboard.html    → injected as "overview"
apps/admin-hub/components/deal-tracker.html       → injected as "deals"
apps/admin-hub/components/listing-workshop.html   → injected as "listings"
apps/admin-hub/components/marketing-workload.html → injected as "marketing"  (newest addition)
apps/admin-hub/components/team-directory.html     → injected as "directory"
apps/admin-hub/components/command-center.html     → injected as "command"   (bundled, hidden — no nav link)
        ↓
node apps/admin-hub/tools/build-admin-console.mjs
        ↓
apps/admin-hub/components/asg-admin-console.html  (paste into Squarespace)
```

**Auth & role gating:**
- Supabase sign-in — Google OAuth restricted to `compass.com` (`hd: compass.com`), or email/password.
- On session, calls `GET /api/auth/me`; only `profile.role ∈ {admin, agent}` may enter. Anyone else is signed back out.
- Authenticated calls to `/api/admin/*` and `/api/portal/*` go through a shared `ASGConsole.authHeaders()` bearer-token helper exposed to every embedded surface.
- A floating **"Take action" FAB** provides quick-create for a new listing, listing edit, deal workflow update, new team member, or announcement — all writing straight to Postgres via `/api/admin/*`.

**Nav today:** Overview · Deals · Listings · Marketing · Team Directory · Account. `command` (Command Center) is bundled into the HTML but has **no nav entry**, so it currently ships dead weight with no way to reach it from the UI.

### 4.2 Console views — what each lets an admin do today

| Tab | Backed by | What it does | Status |
| --- | --- | --- | --- |
| **Overview** | `admin-dashboard.html` (legacy) | KPI strip (volume/closed/pending/deal count), mini team directory, pipeline leaderboard from a Google Sheets CSV export, quick actions (book Acuity / request design work per agent), an **embedded Listing Hub** (its own active/closed grid, search, share/email), recent marketing-asset folders, quick links | Live, but is the **oldest generation** surface and duplicates listing browsing that Listing Workshop now owns |
| **Deals** | `deal-tracker.html` | Pending-deal cards enriched from Follow Up Boss + a Sheet join; checklist toggles (inspection, appraisal, walk, closing, etc.), earnest-money tracking, notes/appointments/action-plan drawer per deal | Live, but **checklist/earnest edits save only to browser `localStorage`** — not persisted server-side, even though `POST /api/admin/deal-workflow` already exists for exactly this purpose (currently only reachable via the FAB) |
| **Listings** (Listing Workshop) | `listing-workshop.html` | The real Supabase-backed listing ops surface: grouped Pre-Listing/Active/Closed list, a 45-day calendar rail of media appointments, per-listing detail view to edit marketing status enums (photos/video/Matterport/floor plan/fact sheet/open house materials), edit asset URLs, upload/reorder/delete photos, create and toggle marketing requests (which mirror to Asana), build a share email, and jump to a prefilled Acuity booking link | Live, fully wired to `/api/admin/listings/*` |
| **Marketing** (Marketing Workload) | `marketing-workload.html` | **Newest feature, actively being finished.** Admin view: create a general marketing task (title, category, assignee, due date, notes) for any agent, see a per-agent open/in-progress/done rollup, drill into an agent's queue, and mark tasks complete/cancelled/reopened — spanning both general tasks and listing-originated requests in one queue. Agent view (same file, role-branched): "request marketing" form + "my marketing" queue | Backend + UI wired; **migration `0018_marketing_tasks.sql` is still untracked/unapplied**, so this doesn't work in production yet |
| **Team Directory** | `team-directory.html` | Searchable/filterable roster grid (stats strip, tier badges, contact actions); admin cards show hours/best contact method, agent cards link to landing page or seller form | Live for browsing, but the roster is a **hardcoded array in the file**, not pulled from the live `/api/directory` or `/api/admin/agents` API — so admin edits made via the FAB ("new team member") won't show up here without a manual rebuild |
| **Account** | Console shell itself | Edit own name/phone, view own recent activity, sign out | Live |
| **Command Center** | `command-center.html` | Would show Executive Scorecard / Agent Adoption / Marketing Operations / System Health tabs | **Bundled but unreachable** — no nav entry; also unauthenticated at the API level (see gaps) |

### 4.3 Legacy / adjacent admin surfaces (outside the console)

| File | Role | Status |
| --- | --- | --- |
| `admin-dashboard.html` | Source of the Overview tab; also still a standalone `/adminhub` block per `docs/DEPLOYMENT.md` | Legacy source, ~6,500 lines |
| `admin-master-dashboard.html` | A richer, parallel "master" dashboard — Buy/Sell/Closed/Data tabs, weekend open-house rail, forecasting, embedded deal tracker | **Not part of the console build at all.** Undecided whether this or `admin-dashboard.html` is meant to be canonical — flagged as an open question in `docs/PROJECT-PHASES-AND-PERFORMANCE.md` too |
| `marketing-assets.html` | Photo library / agent folders / brand library links, recent-folders grid | Legacy standalone `/adminhub` block; overlaps with Overview's folders strip |
| `marketing-output-tracker.html` | Gmail-scan based marketing output KPIs/feed | Optional legacy block, not in console, separate concept from the new Marketing Workload tasks |
| `asg-marketing-dashboard.html` | "Marketing Studio" — Acuity schedule + team performance + Asana/Gmail placeholders | Adjacent ops page, not in console; some sections show literal "connect" placeholders |
| `agent-cards.html` | Near-duplicate of Team Directory with different per-agent CTAs (Landing Page / Seller Form vs Book / Call) | Legacy standalone, ~818 lines |
| `agent-onboarding.html` | Static checklist/content page for onboarding a *new agent* to the team (intake fields, launch checklist, 30-day plan) | Content-only prototype, no backend wiring, no submit handler |
| `tv-dashboard-multiview.html` + `apps/admin-hub/asg-remote/` | Office/Raspberry-Pi TV dashboard (rotating KPI/deals/directory/events views) with a phone remote control server | Live, production ops visibility tool — separate track from the Admin Console entirely |

### 4.4 Backend & data model

**Route surface (`apps/backend/src/routes/admin.ts`)** — grouped by domain, all require an authenticated `admin` (or `admin`/`agent` where noted, "Staff") session or the `X-Asg-Secret` server bypass:

| Domain | Routes | Access |
| --- | --- | --- |
| Listings CRUD & media | `POST/PATCH/DELETE /api/admin/listings[/:id]`, archive, cover, photos add/delete | Staff (hard delete: Admin) |
| Listing workshop | Detail/activity/requests GET, photo upload/register/reorder, Acuity link, marketing request create/patch, share-email builder | Staff (request status patch: Admin) |
| Marketing workload *(new)* | `GET /api/admin/agents`, `GET /api/admin/marketing/workload`, `GET /api/admin/marketing/tasks`, `POST /api/admin/marketing/tasks`, `PATCH /api/admin/marketing/tasks/:id` | Admin |
| Calendar & deals | `GET /api/admin/calendar`, `POST /api/admin/deal-workflow` | Staff |
| Directory/roster | Agent create/update/activate/headshot, bulk sheet upsert | Admin |
| Hub content | Events & Updates CRUD, bulk hub-content sync, listings bulk import | Admin |
| Leads/CRM triage | `GET /api/admin/leads`, `PATCH /api/admin/leads/:id` | Admin |
| Activity & landing | `GET /api/admin/activity`, `PUT /api/admin/landing/:slug/:pageType` | Admin |

All of this is **fully implemented** on the backend. `repositories/admin.ts` exposes matching functions for every route above, plus the very recent addition of `setRequestStatus` (delegating to the new shared `marketingStatus.ts`) and `listAgents` (powers the marketing workload assignee picker).

**Marketing workload data model (new, in flight):**
- `marketing_tasks` table — general (non-listing) work: flyers, social posts, CMAs, ad-hoc design, with category/status/assignee/due date/Asana GIDs.
- `v_marketing_work` view — unions `marketing_tasks` with existing `listing_requests` so the admin workload board and per-agent queue show one combined list regardless of origin.
- `marketingTasks.ts` — create/list/set-status/reassign, with best-effort outbound mirroring to each agent's Asana "Requests" project (`ASANA_AGENT_REQUEST_PROJECTS_JSON`).
- `marketingStatus.ts` — the shared engine (extracted so both the admin hub PATCH and the inbound Asana sync job stay in agreement) that flips listing asset status columns, updates the `marketing_status` rollup, writes client-visible activity, and pushes task completion back to Asana.

**Command Center (`repositories/commandCenter.ts`, `GET /api/command-center`):** aggregates Executive / Adoption / Marketing / System views. Pipeline volume, listing phase mix, adoption page views, and sync-run history are **real**. A meaningful chunk of leadership-facing fields — alerts, FUB appointment/overdue-task counts, funnel consult counts, buy/sell/cash deal mix, adoption compliance/training scores, GitHub/system ownership — are **stubbed to zero or empty**. The endpoint is also **unauthenticated** (public read).

**Scheduler (`apps/backend/src/scheduler.ts`)**, off by default (`ENABLE_SCHEDULER=false`, or manually via `POST /api/sync/:job`):

| Job | Cadence | Feeds |
| --- | --- | --- |
| `idx` | every 15 min | MLS mirror for listings/search |
| `photos` | hourly | Listing photo mirror |
| `fub` | every 30 min | CRM/deals data behind Command Center + Deals tab |
| `pipeline` | every 30 min | Pipeline stats |
| `directory` | daily 6am | Roster seed from `data/roster.ts` + FUB user IDs |
| `marketing` | every 30 min | Asana tasks, Acuity bookings, listing-request delivery status |
| `listing-agent` | every 2 min | AI marketing draft generation (human-reviewed) |

**Asana integration (`connectors/asana.ts`, recently expanded +114 lines):** project/task creation, portfolio routing were already there; this pass adds `setTaskCompleted` (outbound completion sync) and a set of read-only discovery helpers (`getMe`, `listWorkspaces`, `listUsers`, `typeaheadUsers`, `listPortfolios`, `listProjects`) that back a new CLI dev tool, `npm run asana:inspect`, used to find workspace/portfolio/user GIDs to paste into Railway env vars.

**Admin role model (`auth.ts`):** `profiles.role = 'admin'` is a plain Postgres value, guarded by a trigger that prevents anyone from escalating their own role. **✅ No longer manual-SQL-only** — see §4.5: an admin can now grant `role = 'admin'` to a new hire via an in-console invite.

### 4.5 Admin onboarding flow

**✅ Shipped.** New admin/ops hires no longer need a manual SQL update — an existing admin invites them by email from the console, and they land in the Admin Console themselves.

**How it works:**
1. An admin opens the FAB ("Take action") → **Invite admin** → enters the person's email (and optionally their name). This calls `POST /api/admin/invites`.
2. That writes a row to `admin_invites` and calls Supabase Auth's `inviteUserByEmail()` — Supabase sends its own sign-up email (magic link), so **no separate email service was needed**. `handle_new_user()` (the same trigger that gates `role = agent` signups, see `0009_accounts.sql`) was extended in `0020_admin_invites.sql` to check `admin_invites` first: a matching pending, unexpired invite sets `role = 'admin'` directly on the new profile — independent of domain or roster membership, since a new ops hire isn't necessarily an agent.
3. If the email already has an account (any role), Supabase can't send a fresh invite — the same endpoint instead promotes their existing profile to `admin` directly, which is what the admin actually wants in that case.
4. The invited person clicks the email link (lands on `ADMIN_CONSOLE_URL`), which authenticates them before a password is set (a known Supabase quirk — see `supabase/supabase#45210`). The console detects this via the `type=invite` URL param and shows a **set-password gate** before anything else loads.
5. Once their password is set, since their profile has `role = 'admin'` and `portal_onboarding_completed = false`, they see a short **onboarding gate** (name, phone, area of responsibility) before `PATCH /api/auth/me` (extended with a `completeOnboarding` flag) marks onboarding done and drops them straight into the console.

**Not yet built (fine for current team size):** a UI list of pending/claimed invites (the backend already supports it via `GET /api/admin/invites` and `DELETE /api/admin/invites/:id`, just not surfaced in the console yet), and resending an invite that a recipient never completed can occasionally surface a raw Supabase error instead of a clean message (an upstream Supabase Auth inconsistency, not this app's bug — see `supabase/auth#2057`).

### 4.6 New requirement: admin visibility into agent hub usage/performance

New requirement: admins should be able to see how each agent is actually using their Agent Hub — logins, page activity, feature usage — to tell who's engaged and who's gone quiet.

**This already has a home, just an incomplete one.** The usage-beacon → `usage_events` → `telemetry.getAdoption()` → Command Center "Adoption" pipeline (§4.4, §6.1, §6.4) is exactly this feature. Today it's real for raw page-view counts, but several of the fields that would actually answer "is this agent staying on top of it" — FUB compliance, training completion, marketing hygiene scores — are stubbed to zero, and Command Center has no navigation entry in the console at all yet.

**Why this is currently blocked on Agent Hub, not on Admin Hub:** per `docs/AGENT-HUB-PRD.md`, usage attribution today depends on each of the 11 existing agent hub HTML files hardcoding its own agent's email into an inline beacon script — so adoption data only exists for agents who already have a hub file, and it breaks silently for anyone else. Once the templated Agent Hub ships (Agent Hub PRD §8 P1) and every agent's hub renders from one shared template reading their real profile, usage attribution becomes automatic and this feature stops being a per-file bookkeeping problem. The Admin Hub-side work — giving Command Center's Adoption tab a nav entry and filling in the stubbed compliance/training fields — is tracked in §7 P1/P3, but its real payoff waits on the Agent Hub rebuild. See `docs/PLATFORM-ARCHITECTURE.md` §5.3.

## 5. Admin Hub Map

```
Admin Console (asg-admin-console.html)
├─ Overview     → legacy Apps Script/Sheets APIs (pipeline, listings, directory, folders)
├─ Deals        → /api/fub-hub?view=dealTracker  (checklist edits: localStorage only, not persisted)
├─ Listings     → /api/admin/listings/*           (Supabase-first, fully wired)
├─ Marketing    → /api/admin/marketing/*  +  /api/portal/agent/marketing   (new, migration pending)
├─ Directory    → hardcoded roster + /api/directory (read) — FAB writes don't reflect until rebuild
├─ Account      → /api/auth/me, /api/admin/activity
└─ Command      → /api/command-center  (bundled, no nav entry, unauthenticated)

Legacy standalone blocks (still on /adminhub per docs, outside the console):
admin-dashboard.html · admin-master-dashboard.html · marketing-assets.html ·
marketing-output-tracker.html · asg-marketing-dashboard.html · agent-cards.html · agent-onboarding.html

Separate ops track:
tv-dashboard-multiview.html  +  asg-remote (Pi kiosk + phone remote)
```

## 6. Gaps, Risks & Cleanup

### 6.1 Security / correctness — fix first
- **Command Center API is unauthenticated** and exposes pipeline volume, deal counts, adoption data, and marketing ops detail to anyone with the URL. This should require the same admin/staff auth as the rest of `/api/admin/*`, independent of whether it gets a nav entry.
- **Admin listing pickers use the public, unauthenticated `/api/listings?view=all`** (in both the Overview surface and the FAB's listing picker) rather than an authenticated admin read — low severity today since listing data isn't sensitive, but worth aligning for consistency once other endpoints are locked down.
- **✅ Fixed:** promoting someone to `admin` no longer requires a manual database edit — see §4.5 (invite-by-email, `admin_invites` table + `handle_new_user()`).

### 6.2 Data integrity gaps
- **Deal Tracker checklist and earnest-money edits persist only to `localStorage`** in the Deals tab, even though the backend already has `POST /api/admin/deal-workflow` for exactly this. Two admins on two devices will see different "truth" for the same deal.
- **Marketing task migration (`0018_marketing_tasks.sql`) is untracked and not yet applied** — the entire Marketing tab is non-functional in any environment until this ships.
- **General marketing tasks only sync outbound to Asana** (on create/complete) — there's no inbound sync, so a task edited or completed directly in Asana won't reflect back in the admin workload view. Contrast with listing requests, which have real two-way sync.
- **No delete or bulk actions** anywhere in the new marketing/admin routes (tasks, leads, agents) — every correction is a one-by-one PATCH.

### 6.3 Duplication / drift between generations
- **Two competing "browse listings" experiences**: the Overview tab's embedded legacy Listing Hub (Apps Script-backed) vs. the Listings tab's Listing Workshop (Supabase-backed, actually used for edits). Keeping both invites confusion about which one is "real."
- **Team Directory is a hardcoded array** in the console-embedded file, separate from the live `/api/directory` and `/api/admin/agents` APIs that the FAB already writes to. An admin who adds a team member via the FAB won't see them in the directory tab without a manual file edit + rebuild.
- **`admin-dashboard.html` vs `admin-master-dashboard.html`** — two large, overlapping "everything dashboard" files, only one of which (the older, simpler one) is actually wired into the console. No one has declared which is canonical, or whether the richer one's forecasting/deal-table features should be ported into the console instead.
- **`team-directory.html` vs `agent-cards.html`** — near-duplicate roster views with different CTA sets, both still present.
- **Docs are out of date**: `docs/COMPONENT-MAP.md` and `docs/DEPLOYMENT.md` describe the old stacked-blocks `/adminhub` layout, not the unified console; `docs/API-ENDPOINTS.md` is overwhelmingly Apps Script-era and under-documents the Railway `/api/admin/*` surface; `docs/CLAUDE-DASHBOARD-PLAYBOOK.md` is empty.

### 6.4 Missing capability
- **No leads/CRM triage UI** in the console at all, despite `GET/PATCH /api/admin/leads` already existing on the backend — someone has to query the database directly to see or route new onboarding submissions today.
- **Command Center has no nav entry**, so ~1,000+ lines of shipped executive-dashboard UI are currently unreachable by anyone.
- **No structured audit log** — the only trail of who-changed-what is the client-side usage-beacon table (`usage_events`), which is opt-in telemetry, not a real audit trail, plus the per-listing `listing_activity` feed which only covers listings.

## 7. What's Left to Build — Prioritized Roadmap

### P0 — Security & data-integrity fixes
1. Require staff auth on `GET /api/command-center` (currently public).
2. Finish and apply `0018_marketing_tasks.sql` so the Marketing tab actually works end-to-end in production.
3. Wire the Deals tab's checklist/earnest toggles to `POST /api/admin/deal-workflow` instead of `localStorage`, matching the FAB's persistence path.
4. Decide and execute the "two listing UIs" fix — either hide/remove the Overview's embedded legacy Listing Hub, or explicitly scope it to something Listing Workshop doesn't cover.

### P1 — Complete the console migration
1. Add a **Leads triage tab** to the console against the existing `/api/admin/leads` endpoints (list, filter by form type/status, assign to an agent).
2. Give Command Center a nav entry so the Adoption tab (§4.6) is actually reachable, and stub out or hide the fields that are still zero/empty (alerts, FUB appointment counts, funnel, GitHub/system ownership) rather than shipping visibly-fake numbers.
3. Make Team Directory read from `/api/directory` (or `/api/admin/agents`) live instead of a hardcoded array, so FAB-created team members show up without a rebuild.
4. Declare `admin-dashboard.html` or `admin-master-dashboard.html` canonical for anything not yet ported to the console, and retire the other (or explicitly port its unique features — e.g. forecasting — into the console).
5. Update `docs/COMPONENT-MAP.md` and `docs/DEPLOYMENT.md` to describe the console architecture, and give `docs/API-ENDPOINTS.md` a real `/api/admin/*` section.

### P2 — Depth and safety
1. **✅ Shipped:** admin onboarding/provisioning flow (§4.5) — invite-by-email → signup → auto-assigned `admin` role → set-password + short onboarding step → lands in console. Remaining polish: a pending-invites list in the console UI (backend already supports it).
2. Add **inbound Asana sync for general marketing tasks** (mirroring what listing requests already have), so completing a task in Asana reflects back automatically.
3. Add **delete/bulk actions** for marketing tasks, leads, and agents.
4. Turn the usage-beacon + listing-activity combination into something closer to a real **audit log** for admin actions (who changed what listing/task/lead, when).
5. Retire or explicitly archive the duplicate legacy surfaces (6.3) once their unique value has either been ported into the console or confirmed unnecessary.

### P3 — Leadership depth / differentiation
1. Fill in the remaining Command Center stubs with real data sources (GitHub for system health is already scaffolded; FUB appointment/task counts, funnel numbers, and per-agent compliance/training fields for §4.6 all need query work).
2. Add cross-agent marketing SLAs/turnaround reporting (average time from request to delivered), building on the now-unified `v_marketing_work` view.
3. Consider a proper admin activity/audit UI once the underlying log exists (P2.4).
4. Revisit whether the TV Dashboard / Pi Remote track should be pulled into the same auth/data model as the console, or intentionally stay a separate lightweight ops-visibility tool.

## 8. Open Product Decisions

- [ ] Is `asg-admin-console.html` officially the target for `/adminhub` going forward? If yes, when do the legacy stacked blocks get removed from the live Squarespace page?
- [ ] `admin-dashboard.html` vs `admin-master-dashboard.html` — which one (if either) is canonical, and does the richer one's forecasting/Buy-Sell-Closed-Data view get ported into the console?
- [ ] Should sellers/clients ever see more marketing detail than they do today (this is a shared decision with the Client Hub PRD, since it's driven by the same `marketingStatus.ts` engine)?
- [ ] Who should be able to create/assign general marketing tasks — admin only, or should any agent be able to request work for themselves without going through Tim/Ellie (the Marketing tab already technically supports an agent self-serve mode)?
- [x] ~~Is the current manual-SQL admin promotion process acceptable long-term?~~ Resolved — see §4.5, admin invites shipped.
- [ ] Should Command Center become the "leadership home" tab in the console, or a separate protected page entirely?

## 9. Success Metrics (proposed)

| Metric | Why it matters |
| --- | --- |
| % of marketing tasks moved from "requested" to "done" within SLA (once tracked) | Marketing throughput |
| Median time from listing onboarding to first marketing task delivered | Seller-facing speed (ties to Client Hub metrics) |
| Number of admin actions still requiring direct DB access | Console completeness (target: zero) |
| Deal Tracker checklist edit consistency across sessions/devices | Confirms server persistence actually shipped |
| Command Center field "real vs. stub" ratio | Leadership dashboard trustworthiness |
| Time from new-hire signup to fully provisioned admin/agent access | Admin provisioning efficiency |

## 10. Appendix — File & Route Inventory

### Admin Console build system

| File | Role |
| --- | --- |
| `apps/admin-hub/tools/build-admin-console.mjs` | Assembles the six surfaces + shell into the final HTML |
| `apps/admin-hub/tools/console-body.html` | Shell markup, nav chips, FAB modal, surface placeholders |
| `apps/admin-hub/tools/console-config.js` | `window.ASG_*` API base + Supabase config defaults |
| `apps/admin-hub/tools/console-app.js` | Auth, role gate, routing, `window.ASGConsole` bridge |
| `apps/admin-hub/tools/console-shell.css` | Visual system (glass nav, bento modal, Outfit/Poppins) |
| `apps/admin-hub/components/asg-admin-console.html` | **Generated output** — paste target for Squarespace |

### Console-embedded surfaces

| File | Console tab |
| --- | --- |
| `admin-dashboard.html` | Overview |
| `deal-tracker.html` | Deals |
| `listing-workshop.html` | Listings |
| `marketing-workload.html` | Marketing (new) |
| `team-directory.html` | Team Directory |
| `command-center.html` | Command (bundled, no nav entry) |

### Legacy / adjacent (not console-embedded)

| File | Status |
| --- | --- |
| `admin-master-dashboard.html` | Parallel, not in console — needs a decision |
| `marketing-assets.html` | Legacy standalone |
| `marketing-output-tracker.html` | Legacy standalone/optional |
| `asg-marketing-dashboard.html` | Adjacent ops page |
| `agent-cards.html` | Legacy duplicate of Team Directory |
| `agent-onboarding.html` | Content-only prototype |
| `tv-dashboard-multiview.html` + `apps/admin-hub/asg-remote/` | Separate ops-visibility track |

### Backend (`apps/backend/src/`)

| File | Role |
| --- | --- |
| `routes/admin.ts` | All `/api/admin/*` routes |
| `repositories/admin.ts` | Listings/photos/workshop/agents/content/leads/landing functions |
| `repositories/marketingTasks.ts` | General marketing task CRUD + Asana mirror (new) |
| `repositories/marketingStatus.ts` | Shared listing-request status/delivery engine (new) |
| `repositories/commandCenter.ts` | Executive/adoption/marketing/system aggregation |
| `repositories/adminInvites.ts` | Admin invite create/list/revoke + Supabase `inviteUserByEmail` (new) |
| `repositories/directory.ts` | Roster read API + sync helpers |
| `repositories/telemetry.ts` | Usage/adoption/QA-log data |
| `connectors/asana.ts` | Asana project/task/portfolio + discovery helpers |
| `tools/asanaInspect.ts` | Dev CLI (`npm run asana:inspect`) for finding Asana GIDs |
| `sync/marketing.ts` | Scheduled Asana + Acuity + listing-request sync job |
| `scheduler.ts` | Cron registration for all sync jobs |
| `auth.ts` | Role model, `requireAdmin`/`requireWrite` middleware |
| `supabase/migrations/0018_marketing_tasks.sql` | `marketing_tasks` table + `v_marketing_work` view (new, unapplied) |
| `supabase/migrations/0020_admin_invites.sql` | `admin_invites` table + extends `handle_new_user()` to grant `role='admin'` from an invite record (new, applied) |

### Related docs

- `docs/COMPONENT-MAP.md` — describes the pre-console stacked-block layout (needs an update)
- `docs/DEPLOYMENT.md` — maps code blocks to `/adminhub` sections (needs an update)
- `docs/API-ENDPOINTS.md` — mostly Apps Script-era; Railway `/api/admin/*` underdocumented
- `docs/PROJECT-PHASES-AND-PERFORMANCE.md` — notes the undecided "which dashboard is production" question
- `docs/ASANA-LISTING-PROJECTS.md` — Asana project/portfolio routing shared with Client Hub's seller onboarding
- `docs/PLATFORM-ARCHITECTURE.md` — how this hub fits with Client Hub, Agent Hub, and Orchestration Hub; cross-hub specs for admin onboarding (§5.2) and agent usage visibility (§5.3)
- `docs/AGENT-HUB-PRD.md` — the templated-hub rebuild that agent usage attribution (§4.6) depends on
- `docs/FUB-DATA-STANDARDS.md` — the team-facing FUB data checklist this console's numbers/deal tracker/Command Center all depend on
