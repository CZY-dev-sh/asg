# ASG Project Phases and Performance Tracker

Last updated: 2026-04-27

This document tracks what has been built in the ASG workspace, how the work is organized by phase, and what still needs attention. Use it as a running project log for performance, priorities, and next steps.

## Project Snapshot

The project is an operations hub for the Alex Stoykov Group. It combines Squarespace code blocks, Google Apps Script APIs, Google Sheets/Drive data, Follow Up Boss data, and Raspberry Pi TV tooling into one internal admin system.

Main areas built so far:

| Area | Status | Purpose |
| --- | --- | --- |
| Admin Hub UI | Built / evolving | Squarespace dashboard, directory, listings, marketing assets, quick links, and team views. |
| Apps Script APIs | Built / evolving | Sheet, Drive, listing, stats, hub data, FUB, deal tracker, and email automation endpoints. |
| Agent Personal Hubs | Built for many agents | Agent-specific hub pages with team/profile content and FUB pilot integration. |
| Listing Hub | Built | Active/archive listings, listing asset links, and listing email/share workflow. |
| Deal Tracker | Built / needs write-back decisions | FUB + Google Sheet deal workflow view with checklist and earnest money tracking. |
| TV Dashboard | Built / active WIP | Raspberry Pi friendly dashboard for team performance, pipeline, next closings, and system view. |
| Pi Remote | Built | Node remote interface and kiosk tooling for controlling the TV dashboard. |
| Design / IDX Work | Built / ongoing | Global IDX CSS, Squarespace styling, and design token references. |
| Documentation | Built / needs consolidation | API docs, deployment docs, component map, handoff notes, and workflow docs. |

## Phase 1: Workspace Foundation

Status: Complete

What was built:

- Created the root ASG TV Remote workspace with `README.md`, `package.json`, Node scripts, and deployment scripts.
- Organized the repository around `asg-admin-hub/`, `docs/`, `data/`, `scripts/`, `systemd/`, `IDX/`, and design reference folders.
- Added Raspberry Pi deployment and boot automation assets.
- Added npm commands for local server startup, Pi deployment, and canonical data sync.

Key files:

- `README.md`
- `package.json`
- `scripts/deploy-pi.sh`
- `scripts/start-dashboard.sh`
- `systemd/tv-remote.service`
- `systemd/tv-dashboard-kiosk.service`

Performance / quality notes:

- The workspace is simple and portable: Node 18+, no large framework dependency.
- Deployment scripts reduce manual Pi sync work.
- The repo now has a clear structure, but some docs reference files that may not exist in the current tree, such as `admin-dashboard-v2.html`.

## Phase 2: Admin Hub Components

Status: Built / evolving

What was built:

- Built the main Squarespace Admin Hub dashboard component.
- Built team directory and agent card sections.
- Built marketing assets section with photo library, recent folders, brand links, and agent folders.
- Built standalone listing hub component.
- Built admin master dashboard and TV multiview component.
- Built many agent personal hub pages.
- Added component-level CSS scoping conventions to prevent Squarespace style collisions.

Key files:

- `asg-admin-hub/components/admin-dashboard.html`
- `asg-admin-hub/components/admin-master-dashboard.html`
- `asg-admin-hub/components/team-directory.html`
- `asg-admin-hub/components/agent-cards.html`
- `asg-admin-hub/components/marketing-assets.html`
- `asg-admin-hub/components/listing-hub-standalone.html`
- `asg-admin-hub/components/tv-dashboard-multiview.html`
- `asg-admin-hub/components/agent-personal-hub-*.html`
- `docs/COMPONENT-MAP.md`
- `docs/DEPLOYMENT.md`

Performance / quality notes:

- Components are self-contained for Squarespace Code Blocks.
- CSS prefixes help avoid cross-component conflicts.
- Vanilla HTML/CSS/JS keeps deployment simple.
- The component map should be updated if the production dashboard is now `admin-dashboard.html` or `admin-master-dashboard.html` instead of the documented `admin-dashboard-v2.html`.

## Phase 3: Stats and Pipeline Data

Status: Built

What was built:

- Built the Team Stats Apps Script endpoint.
- Supports YTD and all-time agent summaries.
- Supports pipeline view from YTD Closed and YTD Pending sheet tabs.
- Added all-time closed row views for dashboard charting and historical analysis.
- Connected stats data to Admin Hub, TV Dashboard, and agent hub experiences.

Key files:

- `asg-admin-hub/apps-script/team-stats/TeamStats.gs`
- `docs/API-ENDPOINTS.md`
- `asg-admin-hub/components/admin-dashboard.html`
- `asg-admin-hub/components/admin-master-dashboard.html`
- `asg-admin-hub/components/tv-dashboard-multiview.html`

Performance / quality notes:

- The stats API returns structured JSON suitable for multiple consumers.
- It supports both summary and raw-row use cases.
- Future tracking should include endpoint load time, Apps Script errors, and freshness of source sheets.

## Phase 4: Listings and Marketing Assets

Status: Built

What was built:

- Built Listings API with active/archive views.
- Added listing status normalization for active, coming soon, under contract, and closed workflows.
- Added email/share workflow for listing assets.
- Added agent email mapping and internal CC list.
- Built recent Drive folders API for listing photo folders.
- Connected listing data into dashboard and standalone Listing Hub.

Key files:

- `asg-admin-hub/apps-script/listing-hub/ListingHub.gs`
- `asg-admin-hub/apps-script/drive-folders/DriveRecentFolders.gs`
- `asg-admin-hub/components/listing-hub-standalone.html`
- `asg-admin-hub/components/marketing-assets.html`
- `docs/API-ENDPOINTS.md`

Performance / quality notes:

- Listings can be consumed as a simple GET API.
- Listing email sends through Apps Script POST action.
- Recent folder API fetches only the latest folders, which keeps payloads small.
- Email success/failure tracking should be reviewed if listing sends become operationally critical.

## Phase 5: Hub Data API

Status: Built / needs documentation in API reference

What was built:

- Built the Hub Data Apps Script API.
- Reads Directory, Events, and Updates tabs.
- Supports `view=all`, `view=directory`, `view=events`, and `view=updates`.
- Computes team tenure, birthdays, seniority, event groupings, and update ordering.
- Powers richer hub, directory, event, and TV views.

Key files:

- `asg-admin-hub/apps-script/hub-data/HubData.gs`
- `asg-admin-hub/components/team-directory.html`
- `asg-admin-hub/components/admin-dashboard.html`
- `asg-admin-hub/components/admin-master-dashboard.html`
- `asg-admin-hub/components/tv-dashboard-multiview.html`

Performance / quality notes:

- This API centralizes team directory and events logic instead of duplicating it in UI files.
- It returns computed fields that are useful for TV and admin views.
- It should be added to `docs/API-ENDPOINTS.md` so future work has one source of truth.

## Phase 6: Follow Up Boss and Deal Tracker

Status: Built / pilot stage

What was built:

- Built secure Follow Up Boss proxy through Apps Script.
- Keeps the FUB API key in Apps Script Script Properties instead of browser code.
- Supports agent hub data by agent email/name.
- Supports smart list lookup and task/deal summaries.
- Added Deal Tracker view that joins FUB deals with Google Sheet workflow fields.
- Added Schema view for future dropdowns and admin tooling.
- Built Deal Tracker UI with notes, appointments, action plan data, checklist fields, earnest money fields, and local browser persistence.

Key files:

- `asg-admin-hub/apps-script/follow-up-boss/FubAgentHub.gs`
- `asg-admin-hub/components/deal-tracker.html`
- `asg-admin-hub/components/agent-personal-hub-alex-stoykov.html`
- `docs/API-ENDPOINTS.md`

Performance / quality notes:

- Full deal tracker payload is cached for 60 seconds.
- Schema data is cached for 10 minutes.
- The proxy throttles between per-deal sub-calls to respect FUB limits.
- Cold loads may take 5-10 seconds for larger deal pools.
- Local checklist/earnest edits do not write back to FUB or Sheets yet; this is the main product decision still open.

## Phase 7: Agent Personal Hubs

Status: Built / rollout ongoing

What was built:

- Built individual agent personal hub pages for many team members.
- Agent pages share common structure while holding agent-specific profile, links, and data wiring.
- FUB agent hub integration is piloted on at least one agent page.

Key files:

- `asg-admin-hub/components/agent-personal-hub-alex-stoykov.html`
- `asg-admin-hub/components/agent-personal-hub-sam-abadi.html`
- `asg-admin-hub/components/agent-personal-hub-shelly-channey.html`
- `asg-admin-hub/components/agent-personal-hub-*.html`

Performance / quality notes:

- Agent hubs can scale by copying established page patterns.
- The main risk is drift between pages if shared sections are manually copied.
- Consider tracking which agents have production pages, FUB wiring, photo links, and QA complete.

## Phase 8: TV Dashboard and Raspberry Pi Remote

Status: Built / active WIP

What was built:

- Built TV dashboard multiview experience.
- Built pipeline, leaderboard, next closing, and system status style views.
- Built phone/tablet remote control UI.
- Built Node server for TV dashboard serving and remote commands.
- Built Raspberry Pi deployment, kiosk startup, and systemd automation.
- Added handoff notes for the next TV dashboard improvements.

Key files:

- `asg-admin-hub/components/tv-dashboard-multiview.html`
- `server.js`
- `index.html`
- `asg-admin-hub/asg-remote/server.js`
- `asg-admin-hub/asg-remote/index.html`
- `asg-admin-hub/asg-remote/README.md`
- `NEXT-CLI-HANDOFF.md`
- `MAC-STUDIO-PI-WORKFLOW.md`

Performance / quality notes:

- Target device is a Raspberry Pi, so animations should stay lightweight.
- Use long intervals, opacity/transform transitions, and lightweight SVG where possible.
- Avoid high-frequency timers, heavy repaint effects, and large repeated DOM work.
- The current handoff calls for a 60-second system panel rotator and no layout shifts.

## Phase 9: Headshots and Email Automation

Status: Built / needs production URL

What was built:

- Built Team Directory driven headshots mailer.
- Supports dry run, normal send, resend all, and HTML preview.
- Reads Name, Email, and Headshots columns from the directory sheet.
- Optionally updates sent-at and status tracking columns.
- Generates personalized HTML and plain text email content.

Key files:

- `asg-admin-hub/apps-script/headshots/HeadshotsMailer.gs`
- `asg-admin-hub/apps-script/hub-data/HubData.gs`

Performance / quality notes:

- Dry run mode lowers risk before sending.
- Optional sheet status columns make delivery tracking possible.
- `TOUCH_UP_SCHEDULING_URL` currently points to an example URL and should be replaced before production sends.

## Phase 11: Command Center and Observability Layer

Status: Built (initial drop) / progressive rollout

What was built:

- Built the ASG OS Command Center component, a single Squarespace dashboard with four tabs: Executive Scorecard, Agent Adoption, Marketing Operations, and System Health.
- Built the Command Center aggregator Apps Script that fans out to Pipeline Stats, Follow Up Boss, the usage log sheet, Asana (marketing requests), Acuity (marketing bookings), and the GitHub commits API. Each integration degrades gracefully when its Script Property is not set.
- Built the Usage Log Apps Script, a lightweight beacon receiver that appends page-view, click, and custom events to a Google Sheet so adoption can be measured per agent.
- Built a reusable usage beacon snippet under `asg-admin-hub/shared/usage-beacon.js` and wired an inline copy into one agent personal hub (Sam Abadi) as the rollout reference.

Key files:

- `asg-admin-hub/components/command-center.html`
- `asg-admin-hub/apps-script/command-center/CommandCenter.gs`
- `asg-admin-hub/apps-script/usage-log/UsageLog.gs`
- `asg-admin-hub/shared/usage-beacon.js`
- `asg-admin-hub/components/agent-personal-hub-sam-abadi.html` (beacon reference)
- `docs/API-ENDPOINTS.md` (Command Center + Usage Log entries)

Performance / quality notes:

- The aggregator caches the full payload in `CacheService` for 90 seconds by default (override with `COMMAND_CENTER_CACHE_TTL`).
- Each external call is wrapped in its own try/catch and reports its connection state in `meta.sources` so the UI can show per-source diagnostics rather than blank panels.
- The beacon is a single-IIFE script with stable visitor and session IDs in local/session storage; failures are silent so production hubs never break because of telemetry.
- The Usage Log script is intentionally separated from the aggregator so it can be deployed with `Anyone, even anonymous` access without exposing the larger surface.

Open product decisions:

- [ ] Decide whether the Command Center lives on its own page (`/commandcenter`) or as a tab inside the Admin Hub.
- [ ] Decide which Asana Marketing project is the source of truth (single team project, or per-tier projects). Set `ASANA_MARKETING_PROJECT_GID` accordingly.
- [ ] Decide which Acuity calendars count as marketing-team bookings. Set `ACUITY_CALENDAR_IDS` to filter.
- [ ] Decide who owns the QA log (manual entry vs. automated via Apps Script error trigger).

Rollout checklist:

- [ ] Deploy `UsageLog.gs` as a web app with `Anyone, even anonymous` access. Save the URL.
- [ ] Create a Google Sheet for usage events. Copy its file ID into `USAGE_LOG_SHEET_ID` Script Property of both `UsageLog.gs` and `CommandCenter.gs`.
- [ ] Deploy `CommandCenter.gs` as a web app with team-only access. Save the URL.
- [ ] Embed `command-center.html` in a Squarespace page (e.g. `/commandcenter`) and set `window.ASG_COMMAND_CENTER_API` and `window.ASG_FUB_HUB_API` before the component.
- [ ] Add the inline beacon block (or `<script src="shared/usage-beacon.js">`) to every agent personal hub, the admin master dashboard, the listing hub, and the deal tracker. Use Sam's hub as the reference.
- [ ] Set `ASANA_TOKEN`, `ASANA_WORKSPACE_GID`, and `ASANA_MARKETING_PROJECT_GID` to light up the Marketing tab.
- [ ] Set `ACUITY_USER_ID`, `ACUITY_API_KEY`, optional `ACUITY_CALENDAR_IDS` for booking visibility.
- [ ] Set `GITHUB_TOKEN` (if private repo) and `GITHUB_REPO` (e.g. `tim-urmanczy/asg-admin-hub`) for the System Health tab.

## Phase 10: IDX and Design System Work

Status: Built / ongoing

What was built:

- Added IDX CSS categories and global Squarespace CSS build assets.
- Added design system brief, component map, and deployment notes.
- Added Apple and Stripe design reference exports and tokens.
- Added generated visual/design assets for future UI reference.

Key files:

- `IDX/README.md`
- `IDX/squarespace-global.css`
- `IDX/squarespace-global-part-a.css`
- `IDX/squarespace-global-part-b.css`
- `IDX/categories/*.css`
- `docs/ASG-DESIGN-SYSTEM-BRIEF.md`
- `design-references/apple-com/*`
- `design-extract-output/*`

Performance / quality notes:

- Keep IDX CSS modular by category.
- Avoid duplicating large global CSS blocks in Squarespace without tracking the source file.
- Use the design system docs to keep Admin Hub, agent hubs, and public site styling consistent.

## Current Performance Tracker

Use this section to record measurable performance over time.

| Metric | Current target | How to check | Status |
| --- | --- | --- | --- |
| TV dashboard rotation | 60 seconds per system panel | Review `tv-dashboard-multiview.html` behavior on Pi | Not fully wired |
| TV animation cost | Opacity/transform only | Inspect CSS transitions and Pi smoothness | In progress |
| Deal Tracker cached load | Near-instant after first load | Load `?view=dealTracker` twice within 60 seconds | Built |
| Deal Tracker cold load | About 5-10 seconds for larger pools | Use browser network timing or Apps Script logs | Monitor |
| FUB schema cache | 10 minutes | Confirm schema endpoint cache behavior | Built |
| Listings payload size | Small enough for fast Squarespace load | Check active/archive response size | Monitor |
| Recent folders payload | Latest 3 folders | Drive folders API response | Built |
| Headshots send safety | Dry run before send | Run dry run function first | Built |
| Apps Script failures | Zero recurring production errors | Apps Script executions dashboard | Needs recurring review |
| Squarespace page health | No console errors | Browser dev tools after deployment | Needs recurring review |

## Open To-Do List

Highest priority:

- [ ] Finish TV dashboard system rotator behavior.
- [ ] Build Upcoming Closings system panel.
- [ ] Build Quarterly Data system panel.
- [ ] Confirm System Status panel still renders correctly after rotator changes.
- [ ] Replace `TOUCH_UP_SCHEDULING_URL` in the headshots mailer before any production campaign.
- [ ] Add Hub Data API documentation to `docs/API-ENDPOINTS.md`.
- [ ] Reconcile references to `admin-dashboard-v2.html` with the files currently in the repo.

Product decisions:

- [ ] Decide whether Deal Tracker checklist/earnest edits should write back to Google Sheets.
- [ ] Decide whether listing email sends need a persistent send log.
- [ ] Decide whether agent personal hubs need a shared generator/template to reduce manual drift.
- [ ] Decide which dashboard file is the production source of truth for `/adminhub`.

Quality / maintenance:

- [ ] Add a release checklist for Squarespace code block deployments.
- [ ] Track which Apps Script deployment URL maps to each source file.
- [ ] Add a recurring monthly audit for broken links in agent hubs, listing links, and Drive folders.
- [ ] Add QA notes for Pi dashboard testing on the actual device.
- [ ] Keep API docs updated when Apps Script response shapes change.

## Suggested Weekly Review

Use this checklist to review progress and performance.

- [ ] What shipped this week?
- [ ] Which phase moved forward?
- [ ] What broke, slowed down, or confused users?
- [ ] Which endpoint or component needs cleanup?
- [ ] Are any manual workflows ready to automate?
- [ ] Are docs still accurate after the latest changes?
- [ ] What is the one highest-impact next task?

## Phase Status Summary

| Phase | Name | Status | Next action |
| --- | --- | --- | --- |
| 1 | Workspace Foundation | Complete | Keep deploy docs current. |
| 2 | Admin Hub Components | Built / evolving | Reconcile dashboard v2 references. |
| 3 | Stats and Pipeline Data | Built | Monitor endpoint freshness and errors. |
| 4 | Listings and Marketing Assets | Built | Consider persistent email send logging. |
| 5 | Hub Data API | Built | Add to API docs. |
| 6 | FUB and Deal Tracker | Built / pilot | Decide write-back strategy. |
| 7 | Agent Personal Hubs | Built / rollout ongoing | Track per-agent QA status. |
| 8 | TV Dashboard and Pi Remote | Built / active WIP | Finish rotator and quarterly panel. |
| 9 | Headshots Automation | Built | Replace scheduling placeholder. |
| 10 | IDX and Design System | Built / ongoing | Keep CSS source and Squarespace output aligned. |
| 11 | Command Center and Observability | Built / progressive rollout | Deploy UsageLog + CommandCenter web apps, embed beacon in remaining agent hubs, wire Asana/Acuity/GitHub script properties. |

