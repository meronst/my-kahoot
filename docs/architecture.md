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
quizzes      id, owner_id → auth.users, title, scoring_mode (speed|points|results), collect_phone bool, created_at
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

Validation in the database: `valid_options()` (CHECK constraint) enforces 2–4 options (exactly 2 for true/false), exactly one correct, no empty texts. Positions are unique per round/quiz (deferrable, so reordering works in one transaction). A PIN is unique among sessions that aren't finished.

**Who is who:** host = signed-in, non-anonymous user with `app_metadata.role = 'host'` (`is_host()`, [ADR 0003](decisions/0003-host-role.md)); player = anonymous signed-in user.

**Host login (KQ-6):** `/host/login` posts to a Server Action (`signInWithPassword`); the session lives in cookies via `@supabase/ssr`. `proxy.ts` refreshes the token and redirects non-hosts away from `/host/*`; `getHost()` (`lib/auth.ts`) re-checks on every host page.

**API grants (KQ-29):** since 2026 Supabase doesn't grant API access to new tables automatically. Every migration GRANTs exactly what it creates (`supabase/migrations/*_api_grants.sql` shows the pattern); `auto_expose_new_tables: false` in `supabase/config.jsonc` makes local/CI behave like the cloud. GRANT = may the role touch the table; RLS = which rows.

**Security (Row Level Security):**
- `quizzes`, `rounds`, `questions`: host only. Players **never** read `questions`, so answer keys can't leak.
- Players see a question only through `sessions.question_payload` (options **without** the `correct` flag).
- `players`: a player reads and updates only their own row.
- `answers`: inserted only via `submit_answer()`; players can't read any answers (their own result comes in `reveal_payload`).
- `sessions`: a player can read only the session they joined (`is_player_in()`).
- Not-logged-in visitors are denied every game table.
- `owns_session()` / `is_player_in()` are SECURITY DEFINER helpers so policies that reference each other don't recurse.
- Tested in `tests/integration/rls.test.ts`.

**Anonymous sign-in rate limit (production risk):** Supabase limits anonymous sign-ins per IP per hour (default 30). A lecture hall on one Wi-Fi shares one IP, so this must be raised in the cloud project (Authentication → Rate Limits) before the first real lecture (KQ-8).

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

Host RPCs (KQ-9): `start_session`, `reveal_question`, `next_question`, `resume_session`. There's no separate pause/finish call: `next_question` after a round's last question moves to `paused` (with `round_idx` pointing at the round to resume), and after the last round to `finished`. Each host move locks the session row (`select … for update`), so two clicks can't skip a question; `submit_answer` takes a shared lock so answers don't block each other. `submit_answer` returns only `{accepted: true}`: correctness is revealed to phones only in `reveal_payload`. The question order comes from `quiz_sequence(quiz_id)` (rounds by position, then questions; empty rounds skipped).

**Starting a session (KQ-7):** `create_session(quiz_id)` (security invoker, so RLS applies) inserts a session with a random 6-digit PIN, retrying on collision with an active session. `players` and `sessions` are in the `supabase_realtime` publication; the lobby subscribes to `players` INSERTs for its session.

**Realtime reliability lessons (KQ-28):**
- Give Realtime the user's token before subscribing (`auth.getSession()` → `realtime.setAuth()`), otherwise the socket joins as `anon` and RLS delivers nothing.
- `SUBSCRIBED` only means the channel is joined. Create channels with `replication_ready: true` and treat them as live on the `system` "ok" event; re-load the current state at that moment.
- Even then, the first event after the Realtime server starts was observed to be lost (not late) in CI. Screens that must never miss data (the projector lobby) also poll every 1.5s as a safety net. Phones must not poll at that rate (150× the load): the game screens (KQ-9/10) re-sync from `sessions` on `READY` and on reconnect instead.
- `data-realtime` on live components exposes the state (READY, CHANNEL_ERROR, TIMED_OUT, REPLICATION_ERROR) for tests and debugging.

**Realtime traffic per question (150 players):** question shown ~150 messages; answers ~150 (to the host only, spread over the timer); reveal ~150.
`reveal_payload` carries the distribution, correct option, explanation, top-5 leaderboard and every player's score, so phones need no second request.

**Joining (KQ-8):** the phone signs in anonymously **in the browser** (so Supabase's per-IP limit counts the hall, not Vercel's servers), then calls `join_session(pin, nickname)`. Rules live in the function: reconnect returns the existing player for the same login (any state), finished/expired sessions refuse, new players only in `lobby`/`paused`, nickname 1–20 chars and unique per session. `session_preview(pin)` gives the join page only the title and open/closed. `proxy.ts` refreshes logins on `/j` and `/play` too (lectures outlast the 1-hour token). Phones don't poll: they re-sync on Realtime READY and when the page becomes visible again.

**Timer:** the server stores `question_started_at`; phones learn the server-clock offset on join. `submit_answer()` rejects answers after `started_at + time_limit` + 1s grace.

**Scoring** (inside `submit_answer()`):
- `speed`: correct = `round(1000 × (1 − 0.5 × elapsed/limit))` (500–1000); no timer → 1000
- `points`: correct = 1000
- `results`: 0, no leaderboard

**Reconnect:** anonymous auth keeps the player's session in the browser; on reload the player row is found by `auth.uid()`.

**Projector (KQ-10):** `/host/sessions/[id]` renders `<Projector>`, which follows the session with `useLiveSession` (Realtime + 1.5s poll; `progressKey()` makes it accept only forward moves, so a late reply can't undo a newer state). The main button (and Space) calls the next legal engine function; the projector auto-reveals when the countdown (server clock via `server_time()`) hits 0 or every player answered. Option colors+shapes (`lib/answer-style.ts`) are shared with phones.

**Phones (KQ-11):** `<PlayerGame>` uses the same `useLiveSession` with `poll: false` (re-reads on `visibilitychange` instead). One tap = one answer: buttons lock before the network reply, the choice is kept in `localStorage` per question (so a reload still shows "answer received"), and `submit_answer` refuses duplicates anyway. Results come from `reveal_payload.results[playerId]`.

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
