# Changelog

Format: one section per version; entries reference Jira keys.

## v1.0 — Live quiz for lectures (in progress)

### Fixed
- Host forms no longer reset what was typed after a failed save (KQ-30)
- Deployed app: "permission denied for table quizzes": explicit API grants for all game tables; local Supabase now matches the cloud's no-auto-grant behavior (KQ-29)
- Vercel builds: framework pinned to Next.js in `vercel.json` (KQ-25)
- Secret-scan CI job: added the `pull-requests: read` permission (KQ-24)
- RTL check no longer flags comments or words like "right-to-left"; now a tested script, `scripts/rtl-check.mjs` (KQ-23)

### Added
- Load test: 150 simulated players × 5 questions against the cloud project (manual GitHub workflow); result: free tier is enough, 0 dropped, p95 < 0.7 s (ADR 0004, KQ-12)
- Projector audio: synthesized lobby music and sound effects (question, last-5-second ticks, reveal, finale, player joined), mute switch remembered across reloads, no audio on phones (KQ-20)
- Optional phone number on the join screen (only when the quiz asks; consent line; Israeli mobile format), CSV download at a host-only address (no link on the projector, KQ-32), automatic deletion after 30 days by a daily pg_cron job, CI check that numbers never appear in logs (KQ-19)
- Import questions from Excel/CSV: downloadable Hebrew templates, every broken row listed with its row number and reason, preview, all-or-nothing save with `import_rounds()` (KQ-18)
- Images in questions: upload from the editor (resized in the browser to ≤ 1600px, a 6 MB photo ends up ~300 KB), shown on the projector and the phones; `question-images` storage bucket with host-only uploads (KQ-17)
- Rounds and questions editor on the quiz page: add/rename/delete/reorder rounds; add multiple-choice and true/false questions, edit text, options, correct answer, timer and explanation with Hebrew validation; reorder with ▲/▼; `move_round()` / `move_question()` (KQ-16)
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
