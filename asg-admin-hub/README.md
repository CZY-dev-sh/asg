# ASG Admin Hub — Squarespace Code Blocks

This repo contains all custom HTML/CSS/JS code blocks used on the **Alex Stoykov Group Admin Hub** hosted on Squarespace.

## Project Structure

```
asg-admin-hub/
├── components/
│   ├── admin-dashboard.html          # Main bento dashboard (KPIs, directory, insights, actions, listings, quick links)
│   ├── admin-dashboard-v2.html       # V2 with share modal & email functionality
│   ├── team-directory.html           # Full-page team directory with cards, search, filters
│   ├── agent-cards.html              # Agent grid with Book / Request action buttons
│   ├── marketing-assets.html         # Photo library, agent folders, brand assets section
│   └── listing-hub-standalone.html   # Standalone listing hub (independent from dashboard)
├── shared/
│   └── team-data.js                  # Shared team roster & constants (reference only)
├── docs/
│   ├── DEPLOYMENT.md                 # How to deploy changes to Squarespace
│   ├── API-ENDPOINTS.md              # Google Apps Script endpoints reference
│   └── COMPONENT-MAP.md              # Which code block goes where on the site
├── .gitignore
├── .cursorrules                      # Cursor AI project rules
└── README.md
```

## Components Overview

| Component | Squarespace Page | Description |
|---|---|---|
| `admin-dashboard.html` | `/adminhub` | Main dashboard — original version |
| `admin-dashboard-v2.html` | `/adminhub` | Main dashboard — V2 with share/email features |
| `team-directory.html` | `/adminhub` (below dashboard) | Full team directory with card layout |
| `agent-cards.html` | `/adminhub` | Agent action grid (Book a Shoot / Design Request) |
| `marketing-assets.html` | `/adminhub` | Photo library & brand assets section |
| `listing-hub-standalone.html` | Standalone page or embed | Independent listing hub with share modal |

## External Dependencies

- **Google Fonts**: Poppins (400–800)
- **Google Apps Script APIs**: Stats, Folders, Listings, Buyers/Sellers CSV
- **Squarespace**: Hosted as Code Blocks in page sections
- **Google Drive**: Photo folders, agent folders, brand assets
- **Asana**: Design request forms
- **Acuity (as.me)**: Photo shoot booking

## Getting Started

1. Clone this repo
2. Open in Cursor
3. Each `.html` file in `components/` is a self-contained code block
4. To deploy: copy the full contents of a component file → paste into the corresponding Squarespace Code Block

## Branch Strategy

- `main` — production code currently live on Squarespace
- `admin-hub` — active development branch for Admin Hub features
- Feature branches off `admin-hub` for individual changes
# ASG-Website
