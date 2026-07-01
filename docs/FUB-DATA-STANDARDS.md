# FUB Data Entry Standards

Last updated: 2026-07-01
Audience: everyone who touches Follow Up Boss (agents, TC, marketing) — not engineering-only
Status: New. Effective going forward — see `docs/AGENT-HUB-PRD.md` §4.3/§8 for the technical background.

## Why this exists

The Admin Hub and Agent Hub don't have their own copy of your deals and contacts — every 30 minutes, a sync job reads directly from Follow Up Boss and mirrors it into the system every hub is built on. If a field below is left blank or set inconsistently, the matching card, deal, or number **doesn't show up anywhere and doesn't throw an error** — it just silently looks like nothing happened. That's exactly what happened with 168 of our 547 deals today: no one did anything wrong, FUB just never had an agent assigned on those specific deals, so the system had nothing to attach them to.

## Rule #1 (the one that breaks everything else if skipped)

**Your FUB account email must exactly match your `@compass.com` roster email.** This is the single field the entire system joins on — contacts, deals, and tasks all get attributed to you by matching your FUB user account's email to your agent record. A single typo here (as we just found and fixed for one agent) makes your hub look empty even though everything else is correct. When someone new joins FUB, this is the first thing to double check.

## Every deal, every time

| Field (as labeled in FUB) | Why the Admin Hub needs it |
| --- | --- |
| **Team Members** | This is checked *first* — if it's set, the deal shows up under the right agent immediately, full stop. This is the #1 thing to start doing consistently; it's the direct fix for deals that currently show no agent anywhere. |
| **Linked Contact/Person** | If Team Members is ever missed, the system falls back to whoever the deal's linked contact is assigned to — but only if the deal is actually linked to a person. |
| **Stage** | Drives whether a deal counts as open/won/lost/archived everywhere in the Admin Hub. Use stage names that clearly say what they mean (e.g. containing "closed," "under contract," "lost") — the system reads the stage name itself to bucket it. |
| **Deal Name** | Keep using the property address as the deal name (you're already doing this) — it's what displays as the deal's title everywhere. |
| **Price** | Feeds every pipeline-value number in Command Center and the deal tracker. |
| **Projected Close Date / Close Date** | Sorts and surfaces upcoming closings; also the only thing distinguishing "on the calendar" from "no timeline yet." |

## Every contact, every time

| Field | Why it matters |
| --- | --- |
| **Assigned To** | The fallback path when a deal itself doesn't have Team Members set — keep this current even if you're also setting Team Members on the deal, since it's the safety net. |
| **Primary email / phone** | Used to avoid creating duplicate contacts when a new lead comes in that's actually someone already in the system. |
| **Stage** | Feeds lead-status reporting on the admin side. |

## What does *not* belong in FUB

Lender/attorney contacts, earnest money tracking, and the inspection/attorney/appraisal/mortgage-commitment checklist all live in the **Admin Hub's own Deals tab**, not FUB — there's no custom field for these to look for. That data is entered directly in the Admin Hub and is tied to the deal by its FUB deal ID, so it survives even though it's a separate table.

## New team members

Add them to FUB with their exact `@compass.com` email on day one — ideally the same day they're added to the roster/directory sheet. If FUB access lags behind roster access, their hub will look broken (no deals, no stats) until it's added, even though nothing is actually wrong with their account.

## One thing to expect, not report as a bug

Sync runs every 30 minutes, not instantly — so an edit in FUB can take up to half an hour to show up in the Admin Hub or Agent Hub. That's normal.

---

**Concept — What:** *Polling sync* means a background job wakes up on a schedule (here, every 30 minutes) and pulls the latest data from another system, rather than that system pushing updates the instant they happen (a "webhook").
**Why it matters:** it explains the up-to-30-minute lag above — it's a deliberate tradeoff (simpler and more reliable than webhooks) that's expected behavior, not a delay you should chase down as a bug.
**Here:** `apps/backend/src/scheduler.ts` registers the `fub` job on a 30-minute interval; `apps/backend/src/sync/fub.ts` is what runs each time.

Ask "explain polling vs. webhooks" to go deeper.
