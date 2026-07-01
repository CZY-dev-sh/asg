# Orchestration Hub — PRD (Backlog)

Last updated: 2026-07-01
Owner: Tim (sole engineer) — **single-user access, by design**
Status: **Backlog. Not being built yet.** This exists so the concept has a home and isn't lost, and so Cursor understands it's part of the platform's future shape — not so anyone starts building it this week.

## 1. Purpose

The fourth hub, distinct from Client/Admin/Agent Hub in one key way: it has exactly one intended user — you, the sole engineer. Where the other three hubs are about running the business, Orchestration Hub is about running the *system* the business runs on: security posture, database health, usage/audit logs, sync job status, and infrastructure visibility.

See `docs/PLATFORM-ARCHITECTURE.md` for how this fits alongside the other three hubs.

## 2. Why this is separate from Admin Hub

Admin Hub is for Tim/Ellie/Alex/TC to run listings, marketing, and deals — it's a business-operations tool, and its `admin` role is meant to be granted to trusted staff over time. Orchestration Hub is different in kind: it would expose things like environment variable/secret status, raw database health, and security findings that no one but the engineer maintaining the system needs or should see. Mixing the two would mean either over-exposing sensitive system internals to business staff, or under-building Admin Hub's own reporting needs to avoid that. Keeping them separate, with a distinct `owner` role (see `docs/PLATFORM-ARCHITECTURE.md` §4), avoids both problems.

## 3. Rough scope (directional only — not a commitment)

These are the categories you mentioned, kept at the level of "what this would eventually cover," not a designed feature set:

| Area | What it would show |
| --- | --- |
| **Security** | Which API routes are authenticated vs. public (e.g. the Command Center gap flagged in `docs/ADMIN-HUB-PRD.md`), RLS policy coverage per table, exposed secrets/env audit, dependency vulnerability status |
| **Database health** | Migration status (which are applied vs. pending — directly relevant given `0018_marketing_tasks.sql` sitting unapplied today), table sizes/growth, slow queries, backup status |
| **Usage logs** | Raw `usage_events` exploration beyond what Admin Hub's Command Center aggregates — who's hitting what, when, from where, without the "make it presentable for business staff" filter |
| **Sync/job health** | Scheduler run history (`sync_runs`), failure rates per job (IDX, FUB, marketing, directory), last successful run per integration |
| **Infra/cost** | Railway/Supabase usage and cost trends, deployment history |

## 4. Access model

- New `role = owner` value (see `docs/PLATFORM-ARCHITECTURE.md` §4 for the proposed implementation), set manually in the database for your account only — never grantable through any admin UI, never inferred from a roster or domain match.
- No admin, including future hires with `role = admin`, should have default access. If a future ops lead ever needs a subset of this (e.g. sync job status), that should be a deliberate, named exception — not a side effect of being an admin.

## 5. Explicit non-goals (for now)

- Not building any of this yet — this PRD exists purely to reserve the concept and the role model.
- Not a replacement for Admin Hub's Command Center — that stays business-facing and is owned by `docs/ADMIN-HUB-PRD.md`.
- Not a monitoring/alerting product — if real-time alerting is ever needed, that's a separate decision (e.g. adopting an existing tool) rather than something to build from scratch here.

## 6. When to revisit

Reasonable triggers to pull this off the backlog: the team grows past just you maintaining the system, a real security incident or near-miss happens, or the other three hubs reach a stable enough state that system-level visibility becomes the actual bottleneck rather than product features.
