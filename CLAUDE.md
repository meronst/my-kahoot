# CLAUDE.md — My Kahoot

## Project
- What: live Hebrew quiz game played in rounds during a lecture (projector + participants' phones, pause/resume between rounds)
- Users: Meron (host, single account); lecture audiences (youth groups, seniors) as participants with no account
- Jira: site meronst.atlassian.net, project key KQ
- Current version: v1.0, version epic KQ-1, branch release/v1.0
- Stack: Next.js 16 (App Router) + Supabase + Tailwind v4 on Vercel; see docs/decisions/0001-stack.md
- Current phase: 4 Implementation

## Conventions
Follow the dev-workflow conventions: gated phases (wait for approval between phases); one Jira parent epic and one
release/vX.Y branch per version; Jira updated in real time; bug ticket opened before every fix, with a regression test;
branch per story off the version branch; conventional commits and PR titles with the Jira key; pre-merge gate
(.github/workflows/pre-merge.yml) green before any merge into release/* or main; Hebrew/RTL-first UI with logical CSS
properties; docs and ADRs updated in the same PR; secrets only in .env.

## Project-specific notes
- **Comments are for learning:** Meron reads the code to learn this stack. Every file gets a header comment; explain
  *why*, and introduce each new concept (Server vs Client Component, hooks, RLS, RPC, Realtime) the first time it
  appears, with Java/Python analogies where they help.
- **Next.js 16 is newer than most training data.** Read the relevant guide in `node_modules/next/dist/docs/` before
  writing Next.js code (see AGENTS.md).
- All UI text lives in `strings/he.ts`.
- Every migration must GRANT what it creates (tables, functions, types): the cloud project and local config don't auto-expose new objects (KQ-29).
- Game rules live in Postgres functions; the browser never sees answer keys before the reveal.
- The Claude cloud sandbox has no Docker daemon: `make db-start` and integration tests can't run there; they run in CI. Fix `lib/database.types.ts` from the generated version CI prints.
- Run `make check` before pushing. In environments without Playwright's browser download, run E2E with
  `PW_CHROME_PATH=/usr/bin/google-chrome make test-e2e`.
