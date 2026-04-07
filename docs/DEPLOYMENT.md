# Deployment Guide

## How Code Blocks Work on Squarespace

Each component in `components/` is a self-contained HTML file (HTML + `<style>` + `<script>`). To deploy:

1. Open the target page in Squarespace Editor
2. Find (or add) a **Code Block** in the appropriate section
3. Paste the **entire file contents** into the code block
4. Save and publish

## Code Block → Component Mapping

| Squarespace Page | Section / Block | Component File |
|---|---|---|
| `/adminhub` | Hero section (top) | `admin-dashboard-v2.html` |
| `/adminhub` | Below dashboard | `team-directory.html` |
| `/adminhub` | Agent actions section | `agent-cards.html` |
| `/adminhub` | Marketing assets section | `marketing-assets.html` |
| `/adminhub` or standalone | Listing hub section | `listing-hub-standalone.html` |

> **Note**: `admin-dashboard.html` is the original V1 dashboard. The live site uses `admin-dashboard-v2.html` which adds share/email functionality.

## Version History

- **V1** (`admin-dashboard.html`): Original dashboard with KPIs, directory, insights, actions, listing hub, quick links
- **V2** (`admin-dashboard-v2.html`): Adds user login prompt, share modal with email, listing type badges (Sale/Rental), confetti animation on send

## Pre-Deployment Checklist

- [ ] Tested in browser locally (open `.html` file directly)
- [ ] Team roster changes synced across all components
- [ ] API endpoints verified (Stats, Folders, Listings)
- [ ] No console errors in DevTools
- [ ] Mobile responsive check (resize browser to 375px width)
- [ ] Committed to git with descriptive message
