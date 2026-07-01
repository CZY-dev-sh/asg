# Deployment Guide

## Admin Hub Console (`/adminhub`)

The Admin Hub is now a **single generated file** — not a stack of separate code
blocks. `apps/admin-hub/tools/build-admin-console.mjs` composes every surface
(Overview / Deals / Listings / Marketing / Team Directory / Leads), the login
gate, the floating-pill nav, the profile menu, and the floating action button
into one Squarespace-ready file wired to the Supabase backend.

### 1. Rebuild after any change

Re-run the build whenever you edit a surface component or a shell asset
(`console-body.html`, `console-shell.css`, `console-app.js`, `console-config.js`):

```bash
node apps/admin-hub/tools/build-admin-console.mjs
```

This writes `apps/admin-hub/components/asg-admin-console.html`. Do **not** hand-edit
that generated file — edit the sources and rebuild.

### 2. Paste into Squarespace

1. Open the **`/adminhub`** page in the Squarespace Editor.
2. Select the single **Code Block** on that page (the one holding the console).
3. Delete its contents and paste the **entire** contents of
   `apps/admin-hub/components/asg-admin-console.html`.
4. Save and publish.

There is exactly one code block / one page. The backend URL, Supabase URL and
publishable key are baked into the generated file (overridable by defining
`window.ASG_API_BASE` / `window.ASG_SUPABASE_URL` / `window.ASG_SUPABASE_ANON_KEY`
in a `<script>` **before** the console block).

### 3. Deep links

Each surface is addressable by URL hash on the same page — bookmarkable,
shareable, and refresh-safe:

| Surface | Link |
|---|---|
| Overview (Command Center) | `/adminhub#overview` |
| Deals (Buy / Sell / Rent)  | `/adminhub#deals` |
| Listings                   | `/adminhub#listings` |
| Marketing                  | `/adminhub#marketing` |
| Team Directory             | `/adminhub#directory` |
| Leads triage               | `/adminhub#leads` |
| Account / Settings         | `/adminhub#account` |

## Session expiry (Supabase Dashboard — one-time)

Admin sessions are time-boxed via a Supabase setting, not repo code:

1. Supabase Dashboard → **Authentication → Sessions**.
2. Enable **Time-box user sessions** and set it to **720 hours (30 days)**.
3. Save. Existing sessions honor the new limit going forward.

## Data notes

- **Deal side (Buy/Sell/Rent)** is populated at sync time from the FUB pipeline.
  After deploying the backend, run `npm run sync:fub` once so existing deals get
  their `side` backfilled (new/updated deals get it automatically via the sync
  and the FUB webhooks).
- The Team Directory and Leads assign-dropdown both read the live roster from
  `/api/directory`, so teammates added via the FAB (**Team member**) appear
  without a rebuild.

## Pre-Deployment Checklist

- [ ] `node apps/admin-hub/tools/build-admin-console.mjs` ran clean
- [ ] `npm run typecheck` passes in `apps/backend`
- [ ] Backend deployed (Railway) before pasting the console
- [ ] `npm run sync:fub` run once to backfill `deals.side`
- [ ] Supabase session time-box set to 30 days
- [ ] No console errors in DevTools after paste
- [ ] Mobile responsive check (resize to 375px width)
