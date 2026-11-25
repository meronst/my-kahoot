# My Kahoot (החידון שלי)

A live Hebrew quiz game, played in rounds during a lecture. Participants join from their phones by scanning a QR code; the host runs a round of questions, pauses to go back to the lecture, and resumes with the same players and scores.

- Requirements: [docs/requirements.md](docs/requirements.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- Decisions: [docs/decisions/](docs/decisions/)
- Jira: [KQ board](https://meronst.atlassian.net/jira/software/projects/KQ/boards)

## Run locally

Requires Node.js 22.

```bash
make install   # install dependencies
make dev       # http://localhost:3000
```

## Database (Supabase)

The local database runs in Docker with the Supabase CLI. Migrations live in `supabase/migrations/`.

```bash
make db-start    # start local Supabase and apply migrations (needs Docker)
make db-types    # regenerate lib/database.types.ts after changing a migration
make db-reset    # wipe and rebuild the local DB
```

Copy `.env.example` to `.env.local` and fill in the cloud project's URL and publishable key to run the app against the cloud.
Merges to `release/*` or `main` apply new migrations to the cloud project automatically (`.github/workflows/db-deploy.yml`, see [ADR 0002](docs/decisions/0002-database-environments.md)).

## Host account (one-time setup)

1. Supabase dashboard → **Authentication → Users → Add user → Create new user**: your email and a strong password, with "Auto Confirm User" on.
2. **SQL Editor**, run once (with your email):
   ```sql
   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"host"}'
   where email = 'you@example.com';
   ```
3. Log in at `/host/login`. Accounts without the role are refused ([ADR 0003](docs/decisions/0003-host-role.md)).

Locally the seed creates a demo host: `demo-host@my-kahoot.local` / `demo-password-123`.

## Checks

Every pull request into `release/*` or `main` runs the pre-merge gate (`.github/workflows/pre-merge.yml`):
conventions (branch name, PR title with Jira key) · RTL check · secret scan · lint + typecheck · unit · integration · build · E2E.
All 8 are required before the Merge button unlocks.

```bash
make check                      # lint + typecheck + RTL check + unit tests (run before every push)
make build                      # production build
make test-e2e E2E_SCOPE=smoke   # browser tests tagged @smoke (E2E_SCOPE=full for all)
```

## Project layout

```
app/          pages (Next.js App Router) — each folder is a URL
strings/      all UI text (Hebrew)
tests/        unit (Vitest) · integration (Vitest + Supabase) · e2e (Playwright)
docs/         requirements, architecture, decisions (ADRs)
```

## Deploy

Vercel deploys a preview for every pull request and production on merge to `main` (set up in KQ-3).
`vercel.json` pins the framework to Next.js, so the build doesn't depend on Vercel's auto-detection (bug KQ-25).
