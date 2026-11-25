# Changelog

Format: one section per version; entries reference Jira keys.

## v1.0 — Live quiz for lectures (in progress)

### Fixed
- Vercel builds: framework pinned to Next.js in `vercel.json` (KQ-25)
- Secret-scan CI job: added the `pull-requests: read` permission (KQ-24)
- RTL check no longer flags comments or words like "right-to-left"; now a tested script, `scripts/rtl-check.mjs` (KQ-23)

### Added
- Game schema: quizzes, rounds, questions, sessions, players, answers with Row Level Security, option validation, demo seed data, RLS integration tests (KQ-5)
- Supabase setup: CLI config, first migration (`health()`), generated DB types checked in CI, integration tests against a local Supabase stack in CI, automatic migration deploy to the cloud project, ADR 0002 (KQ-4)
- Pre-merge CI gate (8 required checks), reusable setup action, PR template, branch protection on `main` and `release/*` (KQ-3)
- Project scaffold: Next.js 16 + TypeScript strict + Tailwind v4, Hebrew RTL root layout with the Heebo font, UI strings file, Makefile, Vitest and Playwright setup, docs and ADR 0001 (KQ-2)
