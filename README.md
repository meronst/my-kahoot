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
