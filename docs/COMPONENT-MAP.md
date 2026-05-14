# Component Map

## Admin Hub Page Layout (`/adminhub`)

```
┌─────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD                       │
│              (admin-dashboard-v2.html)                   │
│                                                         │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │ KPI 1    │ KPI 2    │ KPI 3    │ KPI 4    │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
│                                                         │
│  ┌──────────┬───────────────┬──────────┐               │
│  │ Team     │  Pipeline     │ Quick    │               │
│  │ Directory│  Insights     │ Actions  │               │
│  │          │  (Leaderboard │ (Select  │               │
│  │ (search, │   Recent Deals│  agent → │               │
│  │  list,   │   Stage Health│  Book /  │               │
│  │  popups) │              )│  Request)│               │
│  │          ├───────────────┤          │               │
│  │          │  Marketing    │          │               │
│  │          │  Assets       │          │               │
│  │          │  (folders)    │          │               │
│  └──────────┴───────────────┴──────────┘               │
│                                                         │
│  ┌─────────────────────────────────────────────┐       │
│  │              LISTING HUB                     │       │
│  │  (Active/Archive tabs, search, filters,      │       │
│  │   card grid + list view, share modal)        │       │
│  └─────────────────────────────────────────────┘       │
│                                                         │
│  ┌─────────────────────────────────────────────┐       │
│  │              QUICK LINKS                     │       │
│  │  (Zillow, Matterport, FUB, MLS, Compass,    │       │
│  │   Blog, Resources, Hubs, Updates, Meetings)  │       │
│  └─────────────────────────────────────────────┘       │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  AGENT CARDS                             │
│                (agent-cards.html)                        │
│  ┌─────────┬─────────┬─────────┐                       │
│  │ Agent 1 │ Agent 2 │ Agent 3 │  Book / Request btns  │
│  ├─────────┼─────────┼─────────┤                       │
│  │ Agent 4 │ Agent 5 │ Agent 6 │                       │
│  └─────────┴─────────┴─────────┘                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│               MARKETING ASSETS                           │
│            (marketing-assets.html)                       │
│  ┌───────────────────────┬──────────────┐               │
│  │  Listing Photo Library│ Agent Folders │               │
│  │  (main folder, edit   ├──────────────┤               │
│  │   requests, recent    │ Brand Library │               │
│  │   folders via API)    │              │               │
│  └───────────────────────┴──────────────┘               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│           MARKETING OUTPUT TRACKER (optional)            │
│         (marketing-output-tracker.html)                  │
│  Time range → Scan Gmail → KPIs, category/week bars,    │
│  feed (Apps Script JSON; same mailbox as web app user)  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                TEAM DIRECTORY                            │
│             (team-directory.html)                        │
│  Stats strip → Filter pills → Search → Card grid       │
│  (Full-page directory with all agent/admin details)     │
└─────────────────────────────────────────────────────────┘
```

## Standalone Components

- **`listing-hub-standalone.html`** — Can be placed on any page independently. Uses its own CSS prefix (`lh-`) and its own IIFE. Connects to Listings API V2 with share/email support.
- **`marketing-output-tracker.html`** — Squarespace: chrome + iframe `?format=html`. Apps Script: **one** file — `MarketingOutputGmail.gs` as `Code.gs`. Repo `MarketingOutputEmbed.html` is reference HTML only (not loaded by the script).

## CSS Prefix Reference

| Component | CSS Prefix | Root ID |
|---|---|---|
| Admin Dashboard (v1/v2) | `asg-h-` | `#asg-hero-dash` |
| Team Directory | `asg-dir-` / `asg-` | `#asg-team-directory` |
| Agent Cards | `admin-` | `.admin-hub-grid` |
| Marketing Assets | `asg-admin-assets__` | `.asg-admin-assets` |
| Marketing Output Tracker | `asg-mot__` | `#asg-mot-marketing-output` |
| Listing Hub Standalone | `lh-` | `#asg-listing-hub-root` |
