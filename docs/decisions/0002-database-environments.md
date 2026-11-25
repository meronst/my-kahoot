# ADR 0002 — Database environments and migrations

Status: accepted, 2026-11-25

## Context
The app needs a database for local development, for CI, and for the deployed app (Vercel previews and production). The Supabase free plan allows two projects; branching (one cloud database per PR) is a paid feature.

## Decision
- **Local and CI:** the Supabase CLI runs the full stack in Docker (`make db-start`). Every migration in `supabase/migrations/` is applied on start. Integration tests run against this local stack in the pre-merge gate.
- **Cloud:** one Supabase project, `my-kahoot`, shared by Vercel previews and production.
- **Migrations deploy automatically** (`.github/workflows/db-deploy.yml`) when a merge lands on `release/**` or `main` and touches `supabase/migrations/`. Only code that passed the pre-merge gate reaches the cloud database.
- **Generated types** (`lib/database.types.ts`) are checked in CI against the migrations (`make db-types-check`), so TypeScript can't drift from the schema.

## Why
- Migrations are tested twice before reaching the cloud: in CI on every PR, and by being applied cleanly from scratch each time `supabase start` runs.
- Deploying from version branches (not only `main`) keeps the Vercel previews working: a preview built from `release/v1.0` needs the tables that branch's code expects.

## Alternatives considered
- **Two cloud projects (staging + production):** cleaner separation, but uses both free slots and doubles the setup. Revisit after v1.0, when real lecture data lives in production.
- **Manual `supabase db push`:** easy to forget; the database and code drift.

## Consequences
- Before v1.0 there's no real data, so a bad migration on the shared project costs little. After v1.0, migrations must be backward-compatible (add columns before using them, never drop in the same release).
- Meron sets three values once in GitHub: secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, variable `SUPABASE_PROJECT_REF`.
- Vercel gets the public URL and publishable key as environment variables; the secret key is never used by the app.
