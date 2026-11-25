# My Kahoot — Architecture v1

Status: approved, 2026-11-25. Stack decision: [ADR 0001](decisions/0001-stack.md).

## 1. Components

```
 Projector (host laptop, browser tab)          Phones (participants)
 ┌──────────────────────────────┐              ┌───────────────────────┐
 │ /host/sessions/[id]          │              │ /j/[pin]  → nickname  │
 │ big-screen view + controls   │              │ /play/[sessionId]     │
 └──────────────┬───────────────┘              └───────────┬───────────┘
                │ RPC calls (host actions)                  │ RPC: join, submit_answer
                │ Realtime subscribe                        │ Realtime subscribe
                ▼                                           ▼
        ┌────────────────────────── Supabase ───────────────────────────┐
        │ Postgres: tables + RPC functions (game logic) + RLS           │
        │ Realtime: postgres_changes on sessions / answers              │
        │ Auth: host = email+password; players = anonymous sign-in      │
        │ Storage: question-images bucket                               │
        │ pg_cron: expire sessions (24h), delete phone numbers (30d)    │
        └────────────────────────────────────────────────────────────────┘
                ▲
                │ Next.js on Vercel serves pages; editor/import use the same Supabase client
```

**Main principle: the database is the referee.** Every game action is a Postgres function (RPC). It checks the rules, writes the new state, and Realtime pushes the change to every screen. The browser never decides scores or sees correct answers early.

## 2. Pages (Next.js routes)

| Route | Who | What |
|---|---|---|
| `/` | Participant | Enter a PIN (fallback when the QR doesn't work) |
| `/j/[pin]` | Participant | QR target: quiz title, nickname (+ optional phone with consent line) |
| `/play/[sessionId]` | Participant | Waiting / question / result / paused / final screens |
| `/host/login` | Host | Email + password |
| `/host` | Host | Quiz list, "start session", system-ready indicator |
| `/host/quizzes/[id]` | Host | Editor: rounds, questions, images, reorder; Excel/CSV import |
| `/host/sessions/[id]` | Host | Projector view with controls (keyboard: Space = next, P = pause) |

All pages are `lang="he" dir="rtl"`. Phone screens use large text and buttons.

## 3. Data model (Postgres)

```
quizzes      id, title, scoring_mode (speed|points|results), collect_phone bool, created_at
rounds       id, quiz_id → quizzes, position, title
questions    id, round_id → rounds, position, type (mc|tf), text, image_path,
             time_limit_sec (null = no timer), explanation,
             options jsonb  -- [{ "text": "...", "correct": true }, ...] 2–4 items
sessions     id, quiz_id, pin (6 digits), status, round_idx, question_idx,
             question_started_at, question_payload jsonb, reveal_payload jsonb,
             created_at, expires_at (created_at + 24h)
players      id, session_id, user_id (auth.uid), nickname, phone (nullable),
             phone_consent_at, score, joined_at        UNIQUE(session_id, nickname)
answers      id, session_id, player_id, question_id, option_idx, answered_at,
             is_correct, points                         UNIQUE(player_id, question_id)
```

**Security (Row Level Security):**
- `quizzes`, `rounds`, `questions`: host only. Players **never** read `questions`, so answer keys can't leak.
- Players see a question only through `sessions.question_payload` (options **without** the `correct` flag).
- `players`: a player reads and updates only their own row.
- `answers`: inserted only via `submit_answer()`; players can't read other players' answers.

## 4. Live session: state machine

```
lobby ──start──► question ──time up / host──► reveal ──next──► question …
                                                │
                                   end of round ▼
                                     paused ──resume──► question (next round)
                                                │
                                   last round   ▼
                                    finished
```

Host RPCs: `start_session`, `next_question`, `reveal_question`, `pause_session`, `resume_session`, `finish_session`.

**Realtime traffic per question (150 players):** question shown ~150 messages; answers ~150 (to the host only, spread over the timer); reveal ~150.
`reveal_payload` carries the distribution, correct option, explanation, top-5 leaderboard and every player's score, so phones need no second request.

**Timer:** the server stores `question_started_at`; phones learn the server-clock offset on join. `submit_answer()` rejects answers after `started_at + time_limit` + 1s grace.

**Scoring** (inside `submit_answer()`):
- `speed`: correct = `round(1000 × (1 − 0.5 × elapsed/limit))` (500–1000); no timer → 1000
- `points`: correct = 1000
- `results`: 0, no leaderboard

**Reconnect:** anonymous auth keeps the player's session in the browser; on reload the player row is found by `auth.uid()`.

## 5. Authoring & import
- Editor: forms per question, drag to reorder, image upload (resized in the browser to ≤ 1600px, stored in Supabase Storage).
- Import: Excel/CSV template parsed in the browser (SheetJS), per-row Hebrew validation, preview, save.
  Columns: `round | question | type (mc/tf) | option1–4 | correct (1–4 / true/false) | time_sec | explanation | image_url`

## 6. Projector audio
Static files, played only on the projector; mute toggle in localStorage.

## 7. Code conventions
- **Explanatory comments for learning:** a header comment per file; comments explain *why* and introduce each new concept the first time it appears.
- TypeScript strict; DB types generated with `supabase gen types`.
- Folders: `app/` routes · `components/` UI · `lib/` clients and helpers · `strings/he.ts` UI text · `supabase/migrations/` SQL · `tests/unit|integration|e2e`.

## 8. Testing
| Make target | Tool | Covers |
|---|---|---|
| `test-unit` | Vitest | scoring, import parser, timer offset, state helpers |
| `test-integration` | Vitest + local Supabase (CLI, Docker) | RPCs, RLS, cron cleanup |
| `test-e2e` | Playwright (he-IL, mobile + desktop) | full game; `@smoke` = join → answer → reveal → pause → resume |
| load test (KQ-12) | script, 150 simulated players | the free-tier message limit |

## 9. Operations
- Keep-alive: daily GitHub Actions cron hits a health endpoint so Supabase doesn't pause.
- `/host` shows a "system ready" indicator before a lecture.
- Environments: local (Supabase CLI in Docker) → CI (same local stack) → Vercel preview per PR and production, both on the one cloud Supabase project. Migrations deploy on merge to `release/**` or `main`. See [ADR 0002](decisions/0002-database-environments.md).
