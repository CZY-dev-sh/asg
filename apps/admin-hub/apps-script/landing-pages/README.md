# ASG Landing Pages API — Setup Guide

This Apps Script powers public-facing, agent-specific Squarespace landing pages.
It is built for a three-page model per agent:

- `general` (buyer/seller/investor blended)
- `seller` (seller workflow focused)
- `buyer` (buyer workflow focused)

It can reuse your existing `Directory` / `Team Directory` tab so you do not need
to re-import core agent profile data (name, email, phone, headshot, socials).
The `Agents` tab becomes optional overrides when you want to customize values.

## Files

- `LandingPages.gs`: sheet-backed API endpoint

## Query Endpoints

- `?view=agent&slug=alex-stoykov&page=general`
- `?view=reviews&slug=alex-stoykov&persona=buyer`
- `?view=idx&slug=alex-stoykov&page=general`
- `?view=all&slug=alex-stoykov&page=seller`
- `?view=schema` (returns expected headers per tab)

## Workbook Tabs And Columns

Use one Google Sheet workbook with these tabs.

### 1) `Agents` (optional override layer)

Required headers:

`agent_slug | name | title | bio_short | bio_long | headshot_url | phone | email | instagram_url | facebook_url | linkedin_url | primary_market | secondary_markets | cta_primary_label | cta_primary_url | cta_secondary_label | cta_secondary_url | active`

If this tab is missing, the API falls back to `Directory` / `Team Directory`.

### 2) `Stats`

Required headers:

`agent_slug | page | metric_key | metric_label | metric_value | metric_subtext | sort_order | active`

Notes:
- `page` supports `general`, `seller`, `buyer`, or `all`
- `sort_order` is numeric (lower first)

### 3) `Reviews`

Required headers:

`agent_slug | source | persona | reviewer_name | rating | quote | source_url | featured | sort_order | active`

Notes:
- `source`: `zillow` or `google`
- `persona`: `buyer`, `seller`, `investor`, or `all`
- `featured`: `1` or `0`

### 4) `PageSections`

Required headers:

`agent_slug | page | section_key | headline | body | chip_1 | chip_2 | chip_3 | cta_label | cta_url | sort_order | enabled`

Use this for content overrides and per-page section toggles.

### 5) `IDXConfig`

Required headers:

`agent_slug | page | widget_title | embed_script | fallback_text | enabled | sort_order`

Store provider script snippets per page type.

### 6) `ListingsCurated` (optional)

Headers:

`agent_slug | page | listing_type | address | price | beds | baths | image_url | status | details_url | sort_order | active`

Useful for past transactions or hand-picked featured listings.

## Alex Seed Data (recommended)

Start with a single `agent_slug` value: `alex-stoykov`.

Populate:
- 4 to 6 `Stats` rows for `general`
- 6 to 10 mixed Zillow/Google `Reviews` rows
- 1 to 2 `IDXConfig` rows for `general`
- 6 to 12 curated `ListingsCurated` rows for past transactions

If Alex already exists in Directory, you only need to add landing-specific tabs
(`Stats`, `Reviews`, `PageSections`, `IDXConfig`, optionally `ListingsCurated`).

## Squarespace Embed Pattern

1. In a page code block, set:

```html
<script>
  window.ASG_LANDING_API = "https://script.google.com/macros/s/.../exec";
</script>
```

2. Paste one of the landing component files into a second code block:

- `components/agent-landing-alex-stoykov-general.html`
- `components/agent-landing-alex-stoykov-seller.html`
- `components/agent-landing-alex-stoykov-buyer.html`

## Deployment

1. Open `script.google.com`
2. New project and paste `LandingPages.gs`
3. Deploy as Web App
   - Execute as: `Me`
   - Access: `Anyone` (or your desired policy)
4. Copy deployment URL into `window.ASG_LANDING_API`

## Failure Handling

The API degrades safely:
- Missing optional tabs return empty collections
- Missing agent row returns `success: false` with an error
- Unknown `page` defaults to `general`
