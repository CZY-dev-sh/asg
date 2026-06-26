# ASG OS Command Center — Deployment Guide

This folder contains the aggregator Apps Script that powers
`asg-admin-hub/components/command-center.html`. It fans out to
six data sources and is the single backend for the four-tab
Command Center dashboard:

1. **Executive Scorecard** — Pipeline stats + FUB rollup (volume, pipeline, leads, appointments, signed, conversion)
2. **Agent Adoption** — Hub usage log + FUB activity per agent + roster
3. **Marketing Operations** — Asana request workload + Acuity bookings
4. **System Health** — GitHub commits + QA log + ownership map

Each integration degrades gracefully — if a Script Property
isn't set, that section is empty and the UI shows
"not connected" instead of breaking.

## File map

| File | Purpose |
|---|---|
| `CommandCenter.gs` | The aggregator Apps Script. Deploy as a web app. |
| `../usage-log/UsageLog.gs` | Tiny beacon receiver. Deploy separately as anonymous web app. |
| `../../shared/usage-beacon.js` | Drop-in JS snippet for hub pages. Inline copy in Sam's hub for reference. |
| `../../components/command-center.html` | The Squarespace dashboard component. |

## One-time deployment (≈ 30 minutes)

### 1. Create the usage log sheet

1. Create a new Google Sheet. Name it something like `ASG Usage Log`.
2. Copy its file ID from the URL (`https://docs.google.com/spreadsheets/d/THIS_PART/edit`).
3. (Optional) Add a tab named `QA` with columns: `timestamp | kind | title | severity | status`. The Command Center will pick it up for the System Health panel.

### 2. Deploy `UsageLog.gs`

1. Open `script.google.com` → New project → Paste the contents of `UsageLog.gs`.
2. Project Settings → Script Properties:
   - `USAGE_LOG_SHEET_ID` = the file ID from step 1.
3. Deploy → New deployment → Web app:
   - Execute as: **Me**
   - Who has access: **Anyone, even anonymous** ← required so beacons fire from any browser.
4. Copy the web app URL — this is `ASG_USAGE_LOG_API`.

### 3. Deploy `CommandCenter.gs`

1. Open `script.google.com` → New project → Paste the contents of `CommandCenter.gs`.
2. Project Settings → Script Properties (set what you have; missing ones gracefully degrade):

   | Property | Value |
   |---|---|
   | `FUB_API_KEY` | (same key used by the FUB proxy) |
   | `USAGE_LOG_SHEET_ID` | file ID from step 1 |
   | `ASANA_TOKEN` | Asana Personal Access Token (Account Settings → Apps → Developer Apps → New PAT) |
   | `ASANA_WORKSPACE_GID` | Workspace GID (visible in any Asana project URL) |
   | `ASANA_MARKETING_PROJECT_GID` | Marketing project GID |
   | `ACUITY_USER_ID` | Acuity → Integrations → API → User ID |
   | `ACUITY_API_KEY` | Acuity → Integrations → API → API Key |
   | `ACUITY_CALENDAR_IDS` | (optional) Comma-separated calendar IDs to filter to marketing-team calendars |
   | `GITHUB_TOKEN` | (optional, only for private repos) Personal Access Token with `repo` scope |
   | `GITHUB_REPO` | `owner/repo` (e.g. `tim-urmanczy/asg-admin-hub`) |

3. Deploy → New deployment → Web app:
   - Execute as: **Me**
   - Who has access: **Anyone with Google account** (or restrict to your domain).
4. Copy the web app URL — this is `ASG_COMMAND_CENTER_API`.

### 4. Embed the dashboard

In Squarespace, create a new page (e.g. `/commandcenter`). Add a Code Block:

```html
<script>
  window.ASG_COMMAND_CENTER_API = "https://script.google.com/macros/s/.../exec";
  window.ASG_FUB_HUB_API        = "https://script.google.com/macros/s/.../exec"; // existing FUB proxy
</script>
```

Then paste the contents of `command-center.html` into a second Code Block on the same page.

### 5. Roll out the beacon to hub pages

The beacon is what makes the Adoption tab actually work. Without it, the Command Center
will show "not connected" on the Usage Log diagnostic chip.

**Reference**: see the bottom of `agent-personal-hub-sam-abadi.html` — there's an inline
beacon block. Copy that block into every hub page that should be measured:

- All `agent-personal-hub-*.html` pages
- `admin-dashboard.html` / `admin-master-dashboard.html`
- `listing-hub-standalone.html`
- `deal-tracker.html`
- `team-directory.html`

For each page, change three values at the top of the beacon block:

```js
var ENDPOINT = "https://script.google.com/macros/s/.../exec"; // your usage log URL
var PAGE = "agent-hub-shelly-channey";                         // unique page slug
var AGENT_EMAIL = "shelly@compass.com";                        // agent's email (omit for shared pages)
var AGENT_NAME  = "Shelly Channey";                            // agent's name
```

For shared pages (e.g. `admin-dashboard`), leave `AGENT_EMAIL`/`AGENT_NAME` empty — the
beacon will still capture views and visitor IDs.

#### Tracking specific clicks

To track a click on a button or link, add `data-track="My Label"`:

```html
<a href="..." data-track="Open FUB Tasks">Tasks</a>
<button class="asg-track" aria-label="Watch Q1 Meeting">Watch</button>
```

The beacon delegates clicks at the document level, so no further wiring needed.
You can also fire custom events from your page code:

```js
window.asgTrack("video_play", "Q1 Team Meeting");
window.asgTrack("form_submit", "Marketing Request", { type: "Listing Photos" });
```

## Sheet schemas

### `Events` tab (auto-created on first POST)

```
timestamp | type | page | label | url | visitor_id | agent_email | agent_name | session_id | user_agent | referrer | meta
```

### `QA` tab (manual or future-automated)

```
timestamp | kind | title | severity | status
```

`severity` should be one of `red`, `amber`, `green`.
`status` of `resolved` or `closed` filters the row out of the dashboard.
`kind` is free-form — examples: `broken_link`, `apps_script_error`, `stale_data`,
`failed_email`, `mobile_layout`, `api_mismatch`.

### `Directory` tab (read by adoption rollup)

The adoption builder reads from a tab named `Directory` (or `Team Directory`) on the
same usage log sheet to know who to score. Minimum columns:

```
name | email | tier
```

You can use the same Google Sheet that already powers the Hub Data API
(`HubData.gs`) by setting `USAGE_LOG_SHEET_ID` to that sheet's ID.

## Caching

`CommandCenter.gs` caches the full response in `CacheService` for 90 seconds by default.
Override with `COMMAND_CENTER_CACHE_TTL` (seconds). Pass `?refresh=1` on any request
to bypass the cache for that call.

## Verifying connectivity

Each tab in the dashboard has a small "diagnostic" chip in the top right corner:

- **Grey** — endpoint not configured (Script Property missing)
- **Green** — endpoint reachable and returned data
- **Amber** — endpoint configured but returning warnings
- **Red** — endpoint configured but failing

Use these chips to diagnose what's not lit up yet without opening the network tab.

## What's intentionally NOT in this version

- **Website / IDX growth** — Not built yet. The user query mentioned a fourth dashboard
  for the website expansion phase; that requires GA4 / Squarespace Analytics / IDX vendor
  hooks that don't exist yet. Add a fifth tab in `command-center.html` and a fifth source
  in `CommandCenter.gs` once those keys are available.
- **Write-back actions** — The dashboard is read-only. Updating an Asana task or
  resolving a QA issue still happens in the source system.
- **Per-agent FUB compliance scoring** — The FUB rollup gives notes/tasks per agent, but
  the "FUB Compliance %" column in the Adoption table needs a heuristic that's specific
  to your team (e.g. "did they touch every assigned lead this week?"). Wire that into
  `_ccBuildAdoption_` once the rules are settled.
- **Training completion** — Not currently surfaced because there's no training-tracking
  sheet yet. When there is, add a tab to the usage log sheet called `Training`
  (`agent_email | course_id | completed_at`) and extend `_ccBuildAdoption_` to read it.
