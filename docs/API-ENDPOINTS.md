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
