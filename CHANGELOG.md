# Changelog

Format: one section per version; entries reference Jira keys.

## v1.0 — Live quiz for lectures (in progress)

### Fixed
- Deployed app: "permission denied for table quizzes": explicit API grants for all game tables; local Supabase now matches the cloud's no-auto-grant behavior (KQ-29)
- Vercel builds: framework pinned to Next.js in `vercel.json` (KQ-25)
- Secret-scan CI job: added the `pull-requests: read` permission (KQ-24)
- RTL check no longer flags comments or words like "right-to-left"; now a tested script, `scripts/rtl-check.mjs` (KQ-23)

### Added
- Quiz management: new quiz, settings page (title, scoring mode, collect phone), duplicate (with rounds and questions), delete with two-click confirmation (KQ-15)
- Final results: `final_payload` with competition ranks (ties share a rank) and top-3 podium; projector podium; phone shows 'place X of N'; host can end early between questions (two-click confirm); results mode shows no podium (KQ-14)
- Pause between rounds: projector shows standings, the next round and the PIN/QR for late joiners; phones show the break; resume continues with the next round (KQ-13)
- Phone game screens: full question, large colored answer buttons, countdown, one tap = one answer (locked instantly, remembered across reload), 'answer received', result with correct/wrong, points and total score (KQ-11)
- Projector screens: live question with colored options, server-clock countdown and answer counter; auto-reveal on time-out or when everyone answered; reveal with distribution, correct answer, explanation and top 5; one main button + Space key for start/reveal/next/resume (KQ-10)
- Game engine in the database: `start_session`, `reveal_question`, `next_question` (round end → paused, last round → finished), `resume_session`, `submit_answer` (server clock, 1s grace, 3 scoring modes), `server_time`; answers broadcast to the host (KQ-9)
- Players join from their phones: PIN entry on `/`, `/j/<PIN>` with the quiz title and nickname, `/play/<session>` with live game state; reconnect keeps name and score; `session_preview()` and `join_session()` (KQ-8)
- Start a session from the host's quiz list: `create_session()` with unique 6-digit PIN; projector lobby with PIN, QR code and players appearing live (Supabase Realtime) (KQ-7)
- Host login: `/host/login` (email + password, Hebrew errors), protected `/host`, sign out, `proxy.ts` session refresh and gate; host = `app_metadata.role = 'host'` (ADR 0003) (KQ-6)
- Game schema: quizzes, rounds, questions, sessions, players, answers with Row Level Security, option validation, demo seed data, RLS integration tests (KQ-5)
- Supabase setup: CLI config, first migration (`health()`), generated DB types checked in CI, integration tests against a local Supabase stack in CI, automatic migration deploy to the cloud project, ADR 0002 (KQ-4)
- Pre-merge CI gate (8 required checks), reusable setup action, PR template, branch protection on `main` and `release/*` (KQ-3)
- Project scaffold: Next.js 16 + TypeScript strict + Tailwind v4, Hebrew RTL root layout with the Heebo font, UI strings file, Makefile, Vitest and Playwright setup, docs and ADR 0001 (KQ-2)
