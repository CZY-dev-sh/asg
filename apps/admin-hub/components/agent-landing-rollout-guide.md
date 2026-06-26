# Agent Landing Rollout Guide

This guide scales the Alex implementation to every agent with sheet-row onboarding.

## 1) Add New Agent Rows

In the Landing Pages workbook:

- Add one row in `Agents`
- Add 4 to 6 rows in `Stats` per page type (`general`, `seller`, `buyer`)
- Add reviews in `Reviews` with `source` set to `zillow` or `google`
- Add per-page copy in `PageSections`
- Add IDX script snippets in `IDXConfig`
- Optional: add closed/featured cards in `ListingsCurated`

Use `agent_slug` everywhere as the primary key.

## 2) Duplicate Squarespace Pages

For each agent:

- General page body embed
- Seller page body embed
- Buyer page body embed

Set these globals in the first code block:

```html
<script>
  window.ASG_LANDING_API = "https://script.google.com/macros/s/.../exec";
  window.ASG_AGENT_LANDING_CONFIG = { slug: "agent-slug", page: "general" };
</script>
```

Then paste either:
- A specific agent file (like Alex variants), or
- `agent-landing-template.html` for a reusable base renderer

## 3) Config-Driven Token Pattern

Keep visual consistency while allowing light personalization:

- Shared tokens: spacing, border radius, card style, text scale
- Per-agent tokens from sheet fields:
  - `primary_market`
  - intro headline/body in `PageSections`
  - CTA label/URL fields in `Agents`
  - persona review filtering in `Reviews`

## 4) Recommended Naming

- Slugs: `first-last` (example: `alex-stoykov`)
- Page URLs:
  - `/alexstoykov`
  - `/alexstoykov-seller`
  - `/alexstoykov-buyer`

## 5) QA Checklist Per Agent

- API returns `success: true` for all 3 page views
- Review cards render for Zillow + Google
- Buyer/Seller persona filtering works
- IDX script loads without console errors
- CTA buttons work on desktop + mobile
- Layout has no overlap at 390px width

## 6) Migration Path

1. Launch Alex pages (done in this pass)
2. Clone to next two agents
3. Move remaining agents in batches
4. Replace manual embeds with template-driven renderer where suitable
