# Asana Listing Projects Setup

Seller onboarding now creates one Asana project per listing. The project name is the listing address.

## Railway Environment Variables

Required:

- `ASANA_TOKEN`
- `ASANA_WORKSPACE_GID`

Portfolio routing:

- `ASANA_LISTINGS_PORTFOLIO_GID`
  - The portfolio that should contain every listing project.
- `ASANA_AGENT_PORTFOLIOS_JSON`
  - JSON mapping agent email to their personal Asana portfolio.
  - Example:

```json
{
  "alex.stoykov@compass.com": "120000000000001",
  "sam.abadi@compass.com": "120000000000002"
}
```

Marketing assignees:

- `ASANA_TIM_USER_GID`
- `ASANA_ELLIE_USER_GID`

If Tim or Ellie GIDs are empty, tasks are still created but remain unassigned.

General (non-listing) marketing tasks:

- `ASANA_AGENT_REQUEST_PROJECTS_JSON`
  - JSON mapping agent email to their `Requests - <Agent>` Asana project gid.
  - General marketing tasks (flyers, social posts, ad-hoc design) created in the hub
    mirror into that project, best-effort. Leave blank to keep them hub-only.
  - Discover the project gids with `npm run asana:inspect "requests -"`.

## What Gets Created

When a seller submits onboarding:

- A Supabase pre-listing row is created or updated.
- An Asana project is created named the property address.
- The project is added to the Listings Portfolio.
- If the listing agent or co-listing agent email appears in `ASANA_AGENT_PORTFOLIOS_JSON`, the project is also added to that agent portfolio.
- Marketing tasks are seeded once:
  - Take photos
  - Matterport
  - Floor plan
  - Create fact sheet
  - Listing video / reels
  - Open house materials

## Admin And Agent Requests

Admin Console and authenticated agent requests reuse the same listing Asana project.

- Admins can request work for any listing.
- Agents can only request work for listings where they are the primary or co-listing agent.
- Request rows remain the ASG system of record in Supabase.
- Completion status syncs back from Asana during the marketing sync job.
