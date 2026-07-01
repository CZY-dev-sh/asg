# Client Hub — PRD & Build Status

Last updated: 2026-07-01
Owner: TBD (product) / Tim (eng)
Status: Living document — update as surfaces ship or scope changes

## 1. Purpose

Alex Stoykov Group is organizing its digital product around **four hubs** (see `docs/PLATFORM-ARCHITECTURE.md` for the full map):

| Hub | Audience | Scope |
| --- | --- | --- |
| **Agent Hub** | ASG agents | Personal hub pages, FUB deal tracker, listing tools, marketing requests |
| **Admin Hub** | Ops/leadership (Tim, Ellie, Alex, TC) | Admin console, command center, listing workshop, marketing workload |
| **Client Hub** | Buyers, sellers, renters, and anonymous prospects | Everything in this document |
| **Orchestration Hub** | Tim only (sole engineer) | Security, DB health, usage logs — backlog, see `docs/ORCHESTRATION-HUB-PRD.md` |

This document is scoped to the **Client Hub**: every surface a prospect or client encounters, from the first anonymous visit to the marketing site through search, onboarding, and the authenticated post-signing portal. It exists to (1) inventory what has actually been built, (2) call out what's stubbed, duplicated, or disconnected, and (3) lay out a prioritized plan to get to a great client digital experience.

Out of scope here: Agent Hub (agent personal hubs, deal tracker) and Admin Hub (admin console, command center, listing workshop, marketing workload) — those get their own PRDs, though this doc references them where the Client Hub depends on their data.

## 2. Vision

> A prospect can discover ASG, search real inventory, and get matched to an agent — all without friction. Once they engage, they move into a single authenticated **Client Hub** that stays with them through the entire buy or sell transaction: onboarding, marketing progress, documents, milestones, and next steps, all in one place instead of scattered across email and texts.

## 3. Personas

| Persona | Entry point | Core need |
| --- | --- | --- |
| **Anonymous prospect** | Homepage, search, social/ads | Browse listings, find an agent, get a sense of ASG's brand and results |
| **Buyer (pre-signing)** | `/buyer-onboarding` | Get matched with an agent, communicate preferences, start seeing curated inventory |
| **Buyer (active client)** | `/client-portal` | Track deal milestones, appointments, next steps for an active purchase |
| **Seller (pre-signing)** | `/seller-onboarding` | Give ASG full property detail, get a marketing plan started |
| **Seller (active client)** | `/client-portal` | See marketing/photo status, listing activity, documents, open house interest |
| **Renter** | `/client-portal` (client-type option) | *Not yet a real workflow — see Gaps* |

## 4. Current State — What's Built

### 4.1 Public discovery layer (anonymous, no auth)

| Surface | Route | Status | Notes |
| --- | --- | --- | --- |
| Homepage | `/` | **Live** (`asg-homepage-redesign.html`) | Hero, featured listings (live API), team video, 4-phase process, neighborhood cards, contact form, reviews |
| Search Homes | `/search-homes` | **Live** (`asg-search-homes.html`, 1,866 lines) | Natural-language search parser, filter panel, saved favorites (localStorage), MLS hand-off to IDX portal |
| Listing detail | `/listing?address=` | **Live** (`asg-listing-details.html`) | Gallery, facts, agent CTA, tour request |
| Listings (full MLS) | `/listings` | **Live** (`asg-listings-overhaul.html`) | IDX iframe embed of `search.alexstoykovgroup.com` |
| Team | `/team` | **Live** (`asg-team-roster.html`) | API-driven roster, ranked by YTD production, expandable Alex bio |
| How We Work | `/how-we-work` | **Live** (`asg-how-we-work-overhaul.html`) | Static 4-phase content, no API |
| Buyers / Sellers landing | `/buyers`, `/sellers` | **Live (fragments)** | Sellers page has an instant-valuation lead form; both link into onboarding |
| About / Neighborhoods | `/about`, `/neighborhoods` | **Live (fragments)** | Static content |
| Agent landing pages | `/alexstoykov`, `-buyer`, `-seller`, etc. | **Partial rollout** | Alex Stoykov's 3 pages launched; template exists (`agent-landing-template.html`) to clone for remaining ~27 agents (see `agent-landing-rollout-guide.md`) |
| Open house schedule | Not yet assigned a slug | **Built, untracked in git** (`asg-open-house-schedule.html`, 1,227 lines) | Polished weekly schedule UI with map, but **all data is hand-edited HTML** — no connection to the `open_houses` table |

Site-wide chrome (`asg-site-css-injection.html` + `asg-site-js-injection.html`) provides the floating nav, search overlay, and footer on every "fragment" page.

### 4.2 Lead capture & onboarding

| Surface | Route | Status | Notes |
| --- | --- | --- | --- |
| Buyer onboarding | `/buyer-onboarding` | **Live, production path** (`asg-buyer-onboarding.html`, 2,044 lines) | 7-step wizard: contact → agent picker → neighborhoods (Leaflet map) → budget slider → beds/baths → property details → review. Auth-gated. |
| Seller onboarding | `/seller-onboarding` | **Live, production path** (`asg-seller-onboarding.html`, 3,022 lines) | Contact → agent → property type, then branches into Single Family / Condo / Multi-Unit / Land questionnaires (mirrors the Asana seller questionnaire). Auth-gated. |
| Legacy/prototype forms | — | **Dead code, not linked from nav** | `buy.html`, `asg-buy-overhaul.html` (React prototypes, no backend), `buyer-page-onboarding-fullspread.html` (3 duplicate implementations, empty webhook) — candidates for deletion |

Both production wizards:
- Are hard-gated behind a Supabase account modal before the form is usable.
- Save/resume via `PUT /api/portal/onboarding/:formType` and finalize via `POST /api/portal/onboarding/:formType/submit`.
- Skip straight to `/client-portal` if the client already has a completed draft for that type.
- Feed the same backend intake pipeline (`repositories/intake.ts`) that also accepts anonymous `POST /api/intake`.

**Seller submit fan-out** (already built): creates/updates a Supabase `listings` row → creates an Asana project named after the property address → seeds 6 marketing tasks (photos, Matterport, floor plan, fact sheet, video, open house materials) → pushes the lead into Follow Up Boss. See `docs/ASANA-LISTING-PROJECTS.md`.

### 4.3 Accounts & authentication

- Single auth system: **Supabase Auth**, used by both clients and agents (`apps/backend/src/auth.ts`).
- Sign-in methods on `/client-portal`: Google, Apple (code path exists, needs Apple Developer credentials), phone OTP (code path exists, needs an SMS provider like Twilio wired in Supabase).
- On signup, a Postgres trigger (`profiles`, migration `0009`) assigns `role`: `@compass.com` emails matched against the agent roster become `agent`; everyone else becomes `client`, with `contact_id` auto-linked if the email matches an existing FUB contact.
- `clientType` (`buyer` / `seller` / `renter` / `undecided`) drives which dashboard the portal renders.

See `docs/CLIENT-PORTAL-AUTH.md` for the Supabase provider setup checklist.

### 4.4 The Client Portal (`/client-portal`)

**Built** (`asg-client-portal.html`, 466 lines; backend in `repositories/portal.ts`):

- Auth screen → client-type chooser (buyer/seller/renter cards) → personalized dashboard.
- **Buyer view:** deal cards with milestone progress bars (sourced from FUB via `contact_id`), appointments, saved onboarding draft; empty state until a deal is linked.
- **Seller view:** listing cards with marketing/photo/MLS status rollup, a computed action-plan checklist (ASG's steps vs. the client's steps), a client-visible activity timeline, document list, and open-house interest metrics (counts only).
- **Renter view:** static UI only — profile/tours/applications rows are **not live data**.
- Everything is served by one endpoint, `GET /api/portal/home`, which aggregates profile + deals + listings + activity + drafts server-side so the frontend stays thin.

### 4.5 Backend & data model supporting the Client Hub

| Layer | Built | Notes |
| --- | --- | --- |
| `repositories/portal.ts` | ✅ | `getPortalHome`, `getClientDeals`, draft save/submit |
| `repositories/intake.ts` | ✅ | Spam-gated intake → `leads` table → FUB push → (seller) listing + Asana creation |
| `repositories/listings.ts` | ✅ | Public listing reads: home, active, search (IDX mirror), single listing, photos |
| `routes/api.ts` — public routes | ✅ | `/api/listings`, `/api/photos`, `/api/intake`, `/api/auth/signup`\|`login` |
| `routes/api.ts` — client-portal routes | ✅ | `/api/auth/me`, `/api/portal/home`, `/api/portal/deals`, `/api/portal/onboarding/*` |
| Database — identity | ✅ | `profiles`, `onboarding_drafts` |
| Database — CRM | ✅ | `leads`, `contacts`, `deals`, `deal_workflow`, `appointments` |
| Database — listings | ✅ | `listings`, `idx_listings`, `listing_photos`, `listing_requests`, `listing_activity` (with `client_visible` flag), `open_houses`, `acuity_appointments` |
| Database — portal extras | ✅ schema / ⚠️ partial API | `listing_documents` (read-only, no upload path), `open_house_leads` (no ingest API yet) |
| Marketing status pipeline | ✅ (backend), 🚧 (in progress) | Asana + Acuity sync flips `listings.marketing_status`/`photos_status` and writes client-visible activity events. A parallel **agent/admin marketing-workload feature** (`marketingTasks.ts`, `marketingStatus.ts`, migration `0018_marketing_tasks.sql`) is actively being built right now — it's an Agent/Admin Hub feature, not client-facing, but it's the mechanism that eventually keeps seller-visible status accurate. |

## 5. Client Hub Map (routes → components → data)

```
Anonymous                          Authenticated (Supabase session)
─────────────                      ─────────────────────────────────
/                (homepage)        /client-portal   (dashboard)
/search-homes    (MLS search)         ├─ buyer:  deals + milestones (FUB)
/listing         (detail)             ├─ seller: listings + marketing rollup +
/listings        (IDX iframe)         │           activity + documents + OH leads
/team                                 └─ renter: static stub
/how-we-work
/buyers /sellers /about /neighborhoods    ↑ gated by
/alexstoykov (+ agent landing rollout)    Supabase auth modal
                                           ↑
/buyer-onboarding  ──┐              GET/PUT/POST /api/portal/onboarding/:formType
/seller-onboarding ──┴─ wizard → submit → /api/intake pipeline
                                       → leads, contacts, deals (FUB)
                                       → (seller) listings + Asana project + tasks
```

All public listing data flows from `idx_listings` (IDX/MLS sync) and `listings` (ASG-managed) through `GET /api/listings`. All portal data flows through the single `GET /api/portal/home` aggregator.

## 6. Gaps, Risks & Cleanup

### 6.1 Stubs and incomplete features (backend confirmed)

- **Renter workflow** — UI exists, no backend behind it (`applications: []`, `tours: []`). Needs a product decision (build vs. cut) before more UI work goes into it.
- **Saved searches** — mentioned in portal copy, not implemented anywhere.
- **Document upload** — `listing_documents` table and read path exist; there is no way for an agent/admin to upload, and no client-facing upload either.
- **Open house lead capture** — `open_house_leads` table exists and the portal shows counts, but there's no QR/sign-in ingest flow yet (portal UI literally says "coming next").
- **Per-task marketing transparency for sellers** — sellers see a rollup (`marketing_status`, `photos_status`, etc.) and a curated activity feed, not the individual task list (`listing_requests`). This is a deliberate simplification today, worth revisiting.
- **Manual contact linking** — a buyer/seller only gets `contact_id` auto-linked if their signup email matches an existing FUB contact exactly. No admin tool exists to link accounts manually when it doesn't match.

### 6.2 Configuration/security cleanup

- `ASG_LEAD_ENDPOINT` is unset in several surfaces (homepage contact form, site-wide `data-asg-form` handler, sellers valuation form) — they currently show a **preview success state** without actually sending anything anywhere. This is a silent lead-loss risk if any of these are live on the real site.
- Google Maps API key and a Supabase anon key are hardcoded directly in a couple of HTML files rather than sourced purely from env/config. Anon keys are publishable by design, but this should be confirmed intentional and consistent across pages.
- Apple Sign-In and phone OTP have working code paths but are not yet live — they need Apple Developer credentials and an SMS provider (e.g. Twilio) configured in Supabase respectively.

### 6.3 Duplicate / superseded files (candidates for deletion or explicit archiving)

| Legacy file | Superseded by |
| --- | --- |
| `buy.html`, `asg-buy-overhaul.html` (React prototypes) | `asg-buyer-onboarding.html` |
| `buyer-page-onboarding-fullspread.html` (3 duplicate flows inside one file) | `asg-buyer-onboarding.html` |
| `asg-home-overhaul.html` | `asg-homepage-redesign.html` |
| `team-roster-client.html`, `asg-team-overhaul.html` | `asg-team-roster.html` |
| `client-homepage-premium.html` | Explicitly labeled "placeholder homepage concept" in its own footer |

Carrying these forward creates real risk: it's easy to edit the wrong file and ship a change nobody sees, or for a new teammate to wire up the dead prototype by mistake.

### 6.4 Content gaps

- Homepage reviews are **explicit placeholders** ("Placeholder review" / "Client Name") — no live Google/Zillow review feed yet.
- Open house schedule requires **manual weekly HTML edits** rather than reading from the `open_houses` table that already exists in the database.

## 7. What's Left to Build — Prioritized Roadmap

### P0 — Fix before broad traffic / trust risk
1. Wire `ASG_LEAD_ENDPOINT` everywhere it's referenced, or explicitly confirm which forms are intentionally in preview mode and gate them from production nav until ready.
2. Decide and execute the legacy-file cleanup list (6.3) — delete or clearly mark archived so no one edits dead pages.
3. Turn on at least one real SMS provider for phone OTP (or hide that sign-in option until it's live) and finish Apple Sign-In credentials, or remove those buttons until ready.
4. Audit hardcoded keys (Maps, Supabase anon) and move to consistent env-driven config across all client pages.

### P1 — Complete the core client transaction experience
1. **Contact linking tool** (Admin Hub, but blocks Client Hub value): let an admin manually link a `profile` to a FUB `contact_id`/listing when auto-match fails, so buyers/sellers aren't stuck with an empty dashboard.
2. **Document upload path**: admin/agent upload → `listing_documents` → client-visible in portal. Needed for disclosures, contracts, inspection reports.
3. **Open house lead capture**: build the QR/sign-in flow into `open_house_leads`, and surface real lead counts (not just static schedule) in both the open house page and the seller portal.
4. **Connect the open house schedule page to real data** — replace hand-edited HTML with a read from `open_houses`/`listings`, removing the weekly manual-maintenance burden.
5. **Decide the renter path**: either build a minimal real version (saved rentals + agent match, no full FUB deal tracking) or remove the renter option from the client-type chooser until it's real.

### P2 — Depth and trust
1. **Live reviews feed** on the homepage (Google/Zillow), replacing placeholders.
2. **Saved searches** in `/search-homes`, tied to the authenticated profile instead of only localStorage favorites, so a buyer's search follows them from anonymous browsing into the portal.
3. **Per-listing marketing transparency for sellers** — expose a light version of the actual task list (photos ✓, Matterport ✓, floor plan pending) rather than a heuristic rollup only, once the Agent/Admin marketing-workload feature stabilizes.
4. **Finish agent landing page rollout** to the remaining ~27 agents from the template (`agent-landing-rollout-guide.md`), since prospects increasingly land on agent-specific URLs from ads/social.
5. **Design system pass** on any surviving legacy pages to match `docs/ASG-DESIGN-SYSTEM-BRIEF.md` tokens.

### P3 — Differentiation / future
1. In-portal messaging or a lightweight "ask your agent a question" thread, so communication doesn't have to fall back to email/text.
2. Milestone notifications (email/SMS) when a deal stage or marketing status changes, instead of requiring the client to check the portal.
3. E-signature / document collection directly in the portal for disclosures and standard paperwork.
4. Self-serve showing/tour requests wired to agent calendars (Acuity or FUB appointments) instead of a generic "request a tour" CTA.

## 8. Open Product Decisions

These need an explicit answer from you before engineering should invest further:

- [ ] Is the **renter** persona a real 2026 priority, or should it be hidden until there's a real workflow to build?
- [ ] Should sellers eventually see **individual marketing task status** (more transparency), or is the current rollup + curated activity feed the intended long-term experience?
- [ ] Which of the duplicate/legacy client pages (6.3) can be deleted outright vs. need a content migration first?
- [ ] Is `/search-homes` meant to become the full, permanent MLS search experience, or is it intentionally a lighter "hand-off" layer to the IDX portal (`search.alexstoykovgroup.com`) long-term?
- [ ] Who owns keeping open house data fresh once it's connected to real data — agents at listing time, or a weekly admin pass?
- [ ] What's the priority of Apple Sign-In / phone OTP relative to just shipping with Google + email/password?

## 9. Success Metrics (proposed)

| Metric | Why it matters |
| --- | --- |
| % of buyer/seller onboarding starts that reach submit | Wizard drop-off / friction |
| % of onboarded clients who create a portal account within 7 days | Portal adoption |
| % of active deals with a linked `contact_id` | Whether buyers actually see their deal in the portal |
| Median time from "materials delivered" to seller seeing it in activity feed | Marketing-status pipeline freshness |
| Search Homes → onboarding conversion rate | Whether search is actually generating leads, not just browsing |
| Open house sign-ins captured digitally vs. paper (once built) | Lead capture completeness |

## 10. Appendix — File Inventory

### Client-facing frontend (`apps/admin-hub/components/`)

| File | Route | Status |
| --- | --- | --- |
| `asg-homepage-redesign.html` | `/` | Live |
| `asg-search-homes.html` | `/search-homes` | Live |
| `asg-listing-details.html` | `/listing` | Live |
| `asg-listings-overhaul.html` | `/listings` | Live (IDX iframe) |
| `asg-team-roster.html` | `/team` | Live |
| `asg-how-we-work-overhaul.html` | `/how-we-work` | Live |
| `asg-buyers-overhaul.html`, `asg-sellers-overhaul.html`, `asg-about-overhaul.html`, `asg-neighborhoods-overhaul.html` | `/buyers`, `/sellers`, `/about`, `/neighborhoods` | Live fragments |
| `asg-buyer-onboarding.html` | `/buyer-onboarding` | Live, production |
| `asg-seller-onboarding.html` | `/seller-onboarding` | Live, production |
| `asg-client-portal.html` | `/client-portal` | Live, production |
| `asg-open-house-schedule.html` | TBD slug | Built, untracked, manual data |
| `agent-landing-template.html` + `agent-landing-alex-stoykov-*.html` | `/{agent-slug}[-buyer|-seller]` | Partial rollout |
| `asg-site-css-injection.html`, `asg-site-js-injection.html` | Global chrome | Live |
| `buy.html`, `asg-buy-overhaul.html`, `buyer-page-onboarding-fullspread.html` | — | Legacy prototypes, recommend removing |
| `asg-home-overhaul.html`, `team-roster-client.html`, `asg-team-overhaul.html`, `client-homepage-premium.html` | — | Superseded/placeholder, recommend removing |

### Backend (`apps/backend/src/`)

| File | Role |
| --- | --- |
| `repositories/portal.ts` | Client portal dashboard aggregation |
| `repositories/intake.ts` | Buyer/seller onboarding intake pipeline |
| `repositories/listings.ts` | Public listing reads (home/search/detail) |
| `repositories/asanaListings.ts` | Seller onboarding → Asana project + task seeding |
| `routes/api.ts` | Public + client-portal API routes |
| `auth.ts` | Supabase auth, role assignment, middleware |
| `supabase/migrations/0002, 0003, 0009, 0012, 0015` | Listings, CRM, profiles/drafts, listing workshop (`client_visible`), portal extras (documents, OH leads) |

### Related docs

- `docs/CLIENT-PORTAL-AUTH.md` — Supabase auth provider setup
- `docs/ASANA-LISTING-PROJECTS.md` — seller onboarding → Asana project fan-out
- `docs/ASG-DESIGN-SYSTEM-BRIEF.md` — design tokens all client surfaces should follow
- `apps/admin-hub/components/agent-landing-rollout-guide.md` — agent landing page rollout playbook
