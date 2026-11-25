# Changelog

Format: one section per version; entries reference Jira keys.

## v1.0 — Live quiz for lectures (in progress)

### Fixed
- Vercel builds: framework pinned to Next.js in `vercel.json` (KQ-25)
- Secret-scan CI job: added the `pull-requests: read` permission (KQ-24)
- RTL check no longer flags comments or words like "right-to-left"; now a tested script, `scripts/rtl-check.mjs` (KQ-23)

### Added
- Pre-merge CI gate (8 required checks), reusable setup action, PR template, branch protection on `main` and `release/*` (KQ-3)
- Project scaffold: Next.js 16 + TypeScript strict + Tailwind v4, Hebrew RTL root layout with the Heebo font, UI strings file, Makefile, Vitest and Playwright setup, docs and ADR 0001 (KQ-2)
