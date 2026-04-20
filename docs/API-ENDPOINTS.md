# API Endpoints Reference

All backend logic runs on **Google Apps Script** web apps deployed as public endpoints.

---

## Pipeline Stats API

**URL**: `https://script.google.com/macros/s/AKfycbz-dZlLjHKgcN-UmVF3O3252VCFDTiMgxtsiW1f-KGxny6F0PI37ntpZQsWni1LxnBLAg/exec`

**Method**: `GET`

**Response**:
```json
{
  "success": true,
  "summary": {
    "grandTotal": 12500000,
    "totalDeals": 45,
    "closedVolume": 8000000,
    "closedDeals": 30,
    "pendingVolume": 4500000,
    "pendingDeals": 15,
    "totalVolume": 12500000,
    "totalTransactions": 45
  },
  "agents": [
    {
      "name": "Agent Name",
      "grandTotal": 2500000,
      "totalDeals": 8,
      "closedVolume": 1800000,
      "closedDeals": 6,
      "pendingVolume": 700000,
      "pendingDeals": 2,
      "buyPct": 62,
      "totalZillow": 500000
    }
  ]
}
```

**Query params**:
- `?period=ytd2026` (default) or `?period=allTime` — agent summary from summary sheets
- `?view=pipeline` — raw deal rows from **YTD Closed** and **YTD Pending** tabs (same spreadsheet). Returns `ytdClosed` and `ytdPending` arrays for the TV pipeline view.

**Used in**: `admin-dashboard.html`, `tv-dashboard-multiview.html`, agent personal hubs

---

## Follow Up Boss Agent Hub API (Pilot)

**Apps Script Source**: `asg-admin-hub/apps-script/follow-up-boss/FubAgentHub.gs`

**URL**: `https://script.google.com/macros/s/REPLACE_WITH_FUB_HUB_DEPLOYMENT/exec`

**Method**: `GET`

**Query params**:
- `?agentEmail=alex.stoykov@compass.com` (recommended filter)
- `?agentName=Alex%20Stoykov` (name fallback)
- `?limit=8` (optional, clamped 1-25)

**Response**:
```json
{
  "ok": true,
  "meta": {
    "generatedAt": "2026-04-16T17:10:49.000Z",
    "contactCount": 4,
    "dealCount": 6,
    "todoCount": 9,
    "doneCount": 7
  },
  "contacts": [
    {
      "id": "12345",
      "name": "Jane Contact",
      "email": "jane@example.com",
      "phone": "312-555-1000",
      "deals": [
        {
          "id": "d-100",
          "title": "123 Main St Purchase",
          "status": "open",
          "stage": "Under Contract",
          "value": 950000,
          "closeDate": "2026-05-20"
        }
      ],
      "adminTasks": {
        "doneCount": 2,
        "todoCount": 3,
        "tasks": [
          {
            "id": "t-51",
            "title": "Collect condo docs",
            "completed": false,
            "dueDate": "2026-04-22"
          }
        ]
      }
    }
  ],
  "summary": {
    "deals": {
      "total": 6,
      "open": 4,
      "won": 1,
      "lost": 1,
      "archived": 0,
      "unknown": 0
    },
    "adminTasks": {
      "doneCount": 7,
      "todoCount": 9
    }
  }
}
```

**Security / secret handling**:
- Store Follow Up Boss API key in Apps Script **Script Properties** as `FUB_API_KEY`.
- Optional Script Properties:
  - `FUB_API_BASE_URL` (defaults to `https://api.followupboss.com/v1`)
  - `FUB_ADMIN_USER_IDS` (comma-separated user IDs treated as admin assignees)
  - `FUB_DEFAULT_LIMIT`
- Never place the API key in hub page HTML/JS (Squarespace source is public to browser users).

**Task status mapping**:
- Done = Follow Up Boss task marked completed (`isCompleted`, `completed`, or `status=completed/done`)
- To Do = any admin task not completed

**Pilot usage**:
- `asg-admin-hub/components/agent-personal-hub-alex-stoykov.html` reads this endpoint via `FUB_HUB_API`.
- UI surfaces Contact -> Deal status/info -> Admin Tasks (Done/To Do).
- Includes loading/empty/error fallback states so existing page sections remain functional if the endpoint fails.

**Rollout to other agent hubs**:
1. Copy FUB block/functions from `agent-personal-hub-alex-stoykov.html` into another `agent-personal-hub-*.html`.
2. Keep `FUB_HUB_API` pointing to the deployed script URL.
3. Ensure `AGENT_PROFILE.name` + `AGENT_PROFILE.email` match the target agent.
4. Validate with one live agent page before broad rollout.

---

## Deal Tracker View (`?view=dealTracker`)

Same Apps Script deployment as the Agent Hub API above. The view parameter switches the response shape.

**URL**: `https://script.google.com/macros/s/REPLACE_WITH_FUB_HUB_DEPLOYMENT/exec?view=dealTracker`

**Method**: `GET`

**Query params**:
- `?view=dealTracker` (required to enter this mode)
- `?refresh=1` — bypass the 60s cache and force a fresh FUB pull
- `?smartListId=172` / `?smartListName=Current Deals` — override the deal pool
- `?agentEmail=` / `?agentName=` — scope to a specific agent

**Data sources joined**:
1. **Follow Up Boss** — deals, persons, notes, appointments, action plans, custom fields, pipelines, stages
2. **Google Sheet** ("Deal Tracker Workflow" tab) — team-specific workflow fields (earnest-money flags, closing checklist, lender/attorney contact info, extension flags)

**Response**:
```json
{
  "ok": true,
  "meta": {
    "generatedAt": "2026-04-20T14:22:03.000Z",
    "dealCount": 5,
    "smartListId": 172,
    "smartListName": "Current Deals",
    "cached": false,
    "sheetRowsLoaded": 8
  },
  "deals": [
    {
      "id": "fub-10293",
      "address": "1428 N Astor St #5A, Chicago IL 60610",
      "client": "Michael & Jessica Reyes",
      "side": "buy",
      "price": 1250000,
      "lender": { "name": "George Kamberos", "company": "Cross Country Mortgage" },
      "attorney": { "name": "Namit Bammi", "company": "Bammi Law Group" },
      "agent": "Alex Stoykov",
      "stage": "Under Contract",
      "dates": {
        "contract": "2026-04-15",
        "inspection": "2026-04-22",
        "attorney": "2026-04-22",
        "appraisal": "2026-05-04",
        "mortgageCommitment": "2026-05-20",
        "closing": "2026-05-27"
      },
      "extended": { "attorney": true, "mortgageCommitment": false },
      "earnest": {
        "initial": { "amount": 5000,  "sent": true,  "receipt": true,  "toClient": true,  "toLender": true },
        "balance": { "amount": 120000, "sent": false, "receipt": false, "toClient": false, "toLender": false }
      },
      "checklist": {
        "inspectionScheduled": true, "inspectionDone": false,
        "appraisalDone": false, "mortgageCommitment": false,
        "finalWalkScheduled": false, "finalWalkDone": false,
        "closingStatement": false, "reviewSent": false,
        "commissionStatement": false, "socialPost": false, "followUp3wk": false
      },
      "fub": {
        "personId": "12345",
        "dealId": "10293",
        "dealUrl": "https://app.followupboss.com/2/deals/10293",
        "personUrl": "https://app.followupboss.com/2/people/view/12345",
        "notes": [{ "id": "n1", "body": "...", "author": "...", "createdAt": "..." }],
        "appointments": [{ "id": "a1", "title": "Inspection", "startsAt": "...", "status": "..." }],
        "actionPlan": { "name": "Under Contract Plan", "doneCount": 7, "totalCount": 14, "nextStep": "Order appraisal" },
        "tags": ["VIP", "Referral"]
      }
    }
  ]
}
```

**Required Script Properties (in addition to `FUB_API_KEY`)**:
- `DEAL_TRACKER_SHEET_ID` — Google Sheet file ID holding the workflow tab

**Optional Script Properties**:
- `FUB_DEAL_TRACKER_SMART_LIST_ID` — Smart List used as the deal pool (defaults to `172`)
- `FUB_DEAL_TRACKER_SMART_LIST_NAME` — Smart List name fallback (defaults to `"Current Deals"`)
- `FUB_CACHE_TTL_SECONDS` — Full-payload cache TTL (defaults to `60`)
- `DEAL_TRACKER_SHEET_TAB` — Sheet tab name (defaults to `"Deal Tracker Workflow"`)

**Deal Tracker Workflow sheet schema** (one row per deal, header row required):

| Column (exact, case-insensitive) | Type | Notes |
|---|---|---|
| `deal_id` | string | Primary key. Either the raw FUB deal id (`10293`) or the prefixed form (`fub-10293`). |
| `lender_name`, `lender_company` | string | Lender contact for the buyer side. |
| `attorney_name`, `attorney_company` | string | Attorney contact. |
| `earnest_initial_amount`, `earnest_initial_sent`, `earnest_initial_receipt`, `earnest_initial_to_client`, `earnest_initial_to_lender` | number / bool | Initial EM tracking. |
| `earnest_balance_amount`, `earnest_balance_sent`, `earnest_balance_receipt`, `earnest_balance_to_client`, `earnest_balance_to_lender` | number / bool | Balance EM tracking (10%). |
| `extended_attorney`, `extended_mortgage_commitment` | bool | Extension flags that flip their timeline dot to the "extended" state. |
| `inspection_scheduled`, `inspection_done`, `appraisal_done`, `mortgage_commitment`, `final_walk_scheduled`, `final_walk_done`, `closing_statement`, `review_sent`, `commission_statement`, `social_post`, `follow_up3wk` | bool | 11 closing-checklist flags matching `CHECKLIST_ITEMS` in `deal-tracker.html`. |
| `inspection_date`, `attorney_date`, `appraisal_date`, `mortgage_commitment_date` | date | Optional overrides if the date isn't on a FUB Appointment or custom field. |

Boolean values accept: `TRUE/FALSE`, `yes/no`, `1/0`, `x`, `done`.

**Rate limits & caching**:
- FUB public API tolerates ~10 req/sec. The proxy sleeps 75ms between per-deal sub-calls.
- Full payload is cached 60s in `CacheService`; schema (custom fields, pipelines, stages) cached 10 minutes.
- Cold load of 20 deals takes ~5-10s; cached response is instant.

**Consumer**:
- `asg-admin-hub/components/deal-tracker.html` reads this endpoint via `window.DEAL_TRACKER_API` (falls back to the baked-in URL constant). Shows loading/refreshing/error states, a "last synced Xs ago" label, and a notes drawer that surfaces the `fub.notes`, `fub.appointments`, and `fub.actionPlan` payload per deal.
- Local checklist/earnest edits persist only in the browser's `localStorage` — writes back to FUB/Sheet are not in scope for the read-only proxy.

---

## Schema View (`?view=schema`)

Same Apps Script deployment. Returns the FUB custom-field catalog plus pipelines and stages. Cached 10 minutes.

**URL**: `https://script.google.com/macros/s/REPLACE_WITH_FUB_HUB_DEPLOYMENT/exec?view=schema`

**Response**:
```json
{
  "ok": true,
  "meta": { "generatedAt": "..." },
  "schema": {
    "customFields": [
      { "id": "1", "name": "dealSide", "label": "Deal Side", "type": "dropdown", "entity": "deal", "options": ["Buy","Sell","Cash"] }
    ],
    "stages": [
      { "id": "9", "name": "Under Contract", "pipelineId": "1", "order": 9 }
    ],
    "pipelines": [
      { "id": "1", "name": "Sales Pipeline" }
    ]
  }
}
```

**Used for**: Future UI dropdowns in the Deal Tracker (stage picker, custom-field admin).

---

## Recent Folders API

**URL**: `https://script.google.com/macros/s/AKfycbwrDNg7tqUcbbOlYzxC67tDDw7_YDcPau_Y38PzzyDkZ1JcT-6ZRG2UKOPtf3eZAic6_Q/exec`

**Method**: `GET`

**Response**:
```json
{
  "success": true,
  "folders": [
    { "name": "123 Main St", "url": "https://drive.google.com/..." },
    { "name": "456 Oak Ave", "url": "https://drive.google.com/..." }
  ]
}
```

**Used in**: `admin-dashboard.html`, `admin-dashboard-v2.html`, `marketing-assets.html`

---

## Listings API (V1 — no email)

**URL**: `https://script.google.com/macros/s/AKfycbyt2jh8kfUatzqtQEHARRCxU8dF3NJ0UkGrWenaCr3mUyG2k1YlTBY_zBx5nzH3sq4_/exec`

**Method**: `GET`  
**Params**: `?view=active` or `?view=archive`

**Response**:
```json
{
  "listings": [
    {
      "address": "123 Main St",
      "neighborhood": "Lincoln Park",
      "agent": "Agent Name",
      "status": "Active",
      "coverImage": "https://...",
      "photos": "https://drive.google.com/...",
      "matterport": "https://my.matterport.com/...",
      "floorPlan": "https://...",
      "factSheet": "https://...",
      "openHouse": "https://...",
      "video": "https://..."
    }
  ]
}
```

**Used in**: `admin-dashboard.html` (V1 dashboard)

---

## Listings API (V2 — with email/share)

**URL**: `https://script.google.com/macros/s/AKfycbzCDWtLVq-QFeKUx1h1jbE_Yd1JBEOXB55xqzkLF_79to-ttuCmqTMNlaB2r5zIznnJ/exec`

**Method**: `GET` (list) / `POST` (send email)

**GET Params**: `?view=active` or `?view=archive`

**GET Response**: Same as V1 plus `listingType` and `emailSent` fields

**POST Body** (send email):
```json
{
  "action": "sendListingEmail",
  "address": "123 Main St",
  "agent": "Agent Name",
  "listingType": "Sale",
  "photos": "https://...",
  "matterport": "https://...",
  "floorPlan": "https://...",
  "factSheet": "https://...",
  "openHouse": "https://...",
  "video": "https://...",
  "neighborhood": "Lincoln Park",
  "sentBy": "Tim Urmanczy"
}
```

**Used in**: `admin-dashboard-v2.html`, `listing-hub-standalone.html`

---

## Pipeline CSV Data

**Buyers CSV**: `https://docs.google.com/spreadsheets/d/e/2PACX-1vRP9DdHc1LRiDAruzEhCvnhOgYfCwgO4Q--5rkENDD4zxwn6UKD40Ux817lNI5kFTIpdeBJj1oieNqs/pub?gid=1143085145&single=true&output=csv`

**Sellers CSV**: `https://docs.google.com/spreadsheets/d/e/2PACX-1vRP9DdHc1LRiDAruzEhCvnhOgYfCwgO4Q--5rkENDD4zxwn6UKD40Ux817lNI5kFTIpdeBJj1oieNqs/pub?gid=1110212825&single=true&output=csv`

**Columns**: `Agent, Address, Price, Stage, Close Date, Photo URL`

**Used in**: `admin-dashboard.html`, `admin-dashboard-v2.html` (Recent Deals, Stage Health views)
