# ASG Platform Architecture — The Four Hubs

Last updated: 2026-07-01
Owner: Tim (sole engineer)
Status: Living document — this is the top-level map. Read this first, then the hub-specific PRD.

## 1. Purpose

There are now four PRDs in this repo:

| Doc | Hub | Audience |
| --- | --- | --- |
| `docs/CLIENT-HUB-PRD.md` | **Client Hub** | Buyers, sellers, renters, prospects |
| `docs/ADMIN-HUB-PRD.md` | **Admin Hub** | Ops/leadership (Tim, Ellie, Alex, TC) |
| `docs/AGENT-HUB-PRD.md` | **Agent Hub** | ASG's ~26 licensed agents |
| `docs/ORCHESTRATION-HUB-PRD.md` | **Orchestration Hub** | You, the sole engineer, only |

This document is the map that ties them together: one product, four audiences, one backend, one database. Its job is to make sure Cursor (and anyone else looking at this repo) understands the overall shape of what's being built before diving into any single hub — and to capture the cross-cutting decisions that don't belong in just one hub's PRD.

## 2. The core principle: Supabase is the single source of truth

Every hub is a different **view** over the same backend. There is one Postgres database (via Supabase), one auth system (Supabase Auth), and one API layer (`apps/backend`, deployed on Railway). No hub should have its own private data store or its own auth system.

This is already mostly true today — the client portal, admin console, and agent portal routes all read/write the same `profiles`, `agents`, `listings`, `deals`, and `marketing_tasks` tables — but there are real exceptions that need to be closed out as each hub matures:

- **Legacy Apps Script / Google Sheets paths are transitional, not permanent.** Several surfaces (all 11 existing agent personal hub pages, the Admin Console's Overview tab, parts of the public site) still call Google Apps Script endpoints or read Google Sheets CSVs directly instead of the Railway API. Every hub PRD's roadmap includes migrating its own surfaces off of these.
- **Three places currently claim to be "the roster"** (`roster.ts`, the Google Sheet synced via `/api/admin/directory`, and `team-directory.html`'s hardcoded array). Per `docs/AGENT-HUB-PRD.md` §4.4, this needs to collapse to one, with Supabase's `agents` table as the actual source of truth and everything else (including any spreadsheet) treated as an *input* to it, not a parallel copy.
- **Roles live in one place:** `profiles.role` in Supabase (`client | agent | admin`, plus a proposed `owner` role for Orchestration Hub — see §4). No hub should invent its own auth or its own notion of who's allowed to do what.

## 3. The Four Hubs at a glance

| Hub | Who | What they do | Access model | Status |
| --- | --- | --- | --- | --- |
| **Client Hub** | Buyers/sellers/renters/prospects | Browse listings, get matched to an agent, onboard, track their transaction | Public site + Supabase Auth (`role = client`) | Largely built; see `docs/CLIENT-HUB-PRD.md` for gaps |
| **Admin Hub** | Ops/leadership | Run listings, marketing, deals, roster | Admin Console + Supabase Auth (`role = admin`, some `staff` routes also allow `agent`) | Mid-migration to a unified console; see `docs/ADMIN-HUB-PRD.md` |
| **Agent Hub** | Every ASG agent | Personal dashboard, deal tracker, self-serve marketing, landing page | Supabase Auth (`role = agent`), gated by roster membership | Backend ready, frontend rollout stuck at 1 of 26 agents; see `docs/AGENT-HUB-PRD.md` |
| **Orchestration Hub** | You only | Security posture, DB health, usage/audit logs, system status | Supabase Auth (`role = owner`, new) | **Backlog — not being built yet** |

## 4. Identity & role model

Current (`apps/backend/src/auth.ts`, migration `0009`):

```
profiles.role ∈ { client, agent, admin }
```

- `client` — default for any non-`@compass.com` signup
- `agent` — automatic for `@compass.com` signups whose email matches a row in `agents` (roster gate)
- `admin` — never automatic; today it's a manual SQL update

**Proposed addition for Orchestration Hub:** a fourth role, `owner`, that is not self-serve and not grantable through any UI — set once, directly in the database, for your account only. Orchestration Hub routes/pages check for `role = owner` specifically, not `admin`, so that no future admin hire ever has default access to it. This is deliberately the opposite of the "self-serve" philosophy everywhere else in the platform — Orchestration Hub is the one place that should stay manual and single-person by design.

## 5. New cross-cutting initiatives (from this planning round)

Four things came out of this conversation that touch more than one hub. Each gets a short spec here and a fuller entry in the relevant hub PRD.

### 5.1 Self-serve agent onboarding → wizard → live hub

**Goal:** a new agent creates their own account with their Compass email, goes through an onboarding wizard that collects their profile info, and lands on their own working personal hub immediately — no one hand-builds an HTML file for them.

**Flow:**
1. Agent signs up with `name@compass.com` → today's roster gate (`agents` table lookup) still applies as the "is this really one of ours" check, but the roster row itself should be creatable by an admin in one step (not a code edit) — see §5.2 for the parallel admin-side flow.
2. On first login, if `profiles.portal_onboarding_completed` (mirroring the pattern the client portal already uses) is false, the agent is routed into an **onboarding wizard** instead of a blank hub: headshot upload, bio, license number, market focus/neighborhoods, social links, preferred branding assets, Acuity booking link, notification preferences.
3. Wizard submit writes directly into `agents` (Supabase) — no Google Sheet round-trip required, though the sheet can remain a bulk-import option for admins.
4. Agent is redirected to `/agent-hub` (or equivalent), which renders **from the templated Agent Hub** (the platform-level rebuild already recommended in `docs/AGENT-HUB-PRD.md` §8 P1) using their own `agents` row and the already-agent-agnostic `/api/portal/agent/*` routes. No new HTML file, no manual `AGENT_PROFILE` edit.

**Dependency:** this flow only works once the templated Agent Hub (P1 in the Agent Hub PRD) exists — building the wizard on top of today's copy-per-agent HTML files would just add a fourth manual step to an already-manual process. Full spec lives in `docs/AGENT-HUB-PRD.md`.

### 5.2 Admin onboarding → lands in Admin Hub

**Goal:** a new admin/ops hire gets a real onboarding flow instead of a manual SQL role change, and lands directly in the Admin Console once done.

**Flow:**
1. An existing admin invites a new admin by email (new capability — today there's no invite mechanism at all, just a database edit).
2. New admin signs up (or accepts the invite) with their `@compass.com` email → role is set to `admin` directly by the invite, not inferred from domain or roster the way `agent` is.
3. A short admin onboarding step collects anything needed for their profile (name, phone, area of responsibility) and lands them in the Admin Console at `/adminhub`.

**Dependency:** this requires building the admin invite/provisioning capability flagged as a high-severity gap in `docs/ADMIN-HUB-PRD.md` §6.1 and §7 P2. Full spec lives there.

### 5.3 Admin visibility into agent hub usage/adoption

**Goal:** you (or any admin) can see who's actually using their Agent Hub — logins, page views, feature usage — so you can tell who's engaged and who's gone cold.

**This already has a home:** the usage-beacon → `usage_events` → `telemetry.getAdoption()` → Command Center "Adoption" pipeline described in `docs/ADMIN-HUB-PRD.md`. Today it's real for page-view counts, but several of the actual "is this agent staying on top of it" fields (FUB compliance, training, hygiene scores) are stubbed to zero, and Command Center itself has no navigation entry in the Admin Console yet.

**What changes given this conversation:** once the templated Agent Hub (§5.1) exists and every agent has a real hub instead of 11 hand-copied files, usage attribution becomes automatic (today it depends on each HTML file hardcoding its own agent email into the beacon). This turns "admin visibility into agent adoption" from a per-file bookkeeping problem into something that just works once the Agent Hub rebuild ships. The concrete UI work (giving Command Center's Adoption tab a nav entry, filling in the stubbed compliance fields) is tracked in `docs/ADMIN-HUB-PRD.md`.

### 5.4 Orchestration Hub (new, backlog)

Your own command center: security posture, database health, usage/audit logs, sync job status, secrets/env inventory. Single-user access (`role = owner`). This is explicitly **not being built now** — see `docs/ORCHESTRATION-HUB-PRD.md` for the backlog scope, kept intentionally light since it's back-burner.

## 6. Target repo structure (proposed — not yet executed)

Today, `apps/admin-hub/components/` is a flat folder holding files for **all three active hubs at once** (client-facing pages, the admin console, and every agent's personal hub), which is a natural side effect of the repo growing before the 3-hub distinction existed. The clean target state groups by hub instead of by "everything that isn't the backend":

```
apps/
  client-hub/          # public site, onboarding wizards, client portal (see CLIENT-HUB-PRD appendix for file list)
  admin-hub/           # admin console build system + legacy admin surfaces (see ADMIN-HUB-PRD appendix)
  agent-hub/           # personal hub template/pages, agent landing pages (see AGENT-HUB-PRD appendix)
  orchestration-hub/   # new, empty scaffold — build when taken off the backlog
  backend/             # shared Fastify/Postgres API — already correctly separated; powers all four hubs
infra/                 # Pi/TV deployment, unrelated to the 4-hub split
design/                # design system references, unrelated to the 4-hub split
docs/                  # this doc + the 4 hub PRDs + supporting docs
```

Each hub PRD's appendix already lists exactly which current files belong to it, so this mapping is mechanical once you're ready to execute it — it's a rename/move operation, not a rewrite. The **risk** is that several of these files are live Squarespace-embedded code blocks and build scripts with relative-path assumptions (`build-admin-console.mjs`, `docs/DEPLOYMENT.md`, the Squarespace redirect URLs in `docs/CLIENT-PORTAL-AUTH.md`), so this should be its own deliberate migration pass with a checklist, not a side effect of unrelated feature work. See the open decision in §8.

## 7. Recommended sequencing across all four hubs

1. **Data hygiene first** (Agent Hub PRD P0): fix FUB name-matching and pick one roster source of truth. Everything else — onboarding wizards, usage visibility — silently breaks if this isn't solid.
2. **Admin provisioning flow** (Admin Hub PRD, elevated by §5.2): needed before you can safely onboard more admins, and it's a small, well-scoped build.
3. **Templated Agent Hub** (Agent Hub PRD P1): the actual unlock for §5.1's self-serve onboarding wizard. Do this before building the wizard, not after.
4. **Self-serve agent onboarding wizard** (§5.1): now that there's a template to land agents on, build the wizard that replaces manual HTML copying.
5. **Admin visibility into agent usage** (§5.3): mostly falls out of step 3–4 once usage attribution is automatic; finish wiring the remaining Command Center stubs.
6. **Repo restructuring** (§6): once the above is stable, do the physical file move as its own tracked pass.
7. **Orchestration Hub**: last, whenever you decide to take it off the backlog.

## 8. Open Decisions

- [ ] Do you want the repo restructuring (§6) done now, as a dedicated pass, or deferred until after the Agent Hub template/onboarding work lands? (Recommendation: defer — restructuring 80+ files while the Agent Hub rebuild is also touching many of the same files invites merge pain for no functional benefit yet.)
- [ ] For admin invites (§5.2): should any existing admin be able to invite a new admin, or should that stay restricted to you (`owner`) only?
- [ ] For the agent onboarding wizard (§5.1): should it fully replace `agent-onboarding.html`'s admin-facing checklist, or should that checklist remain as the *admin's* side of the process (license/compliance verification) while the wizard is the *agent's* side (self-reported profile info)?
- [ ] Should `owner` be a fifth value in the existing `profiles.role` enum, or a separate boolean/flag on top of `admin` (simpler migration, slightly less clean separation)?
