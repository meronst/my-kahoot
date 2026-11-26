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

**Phone numbers (KQ-19):** only when the quiz has `collect_phone`. The join form shows an optional field with the consent line; `join_session(pin, nickname, phone)` keeps the number only for such quizzes, normalizes it (`normalize_phone()`, mirrored by `lib/phone.ts`: Israeli mobile → `05XXXXXXXX`, else `phone_invalid`) and stamps `phone_consent_at`. Reading follows players RLS: the player's own row and the host. The host gets them at `/host/sessions/[id]/phones` (not linked from any screen in v1.0, KQ-32; a host screen with past games comes in v2.0, KQ-33) — a Route Handler: CSV with BOM, dd/MM/yyyy, spreadsheet-formula guard, `no-store`). `delete_expired_phones()` runs daily at 03:17 UTC from **pg_cron** and erases numbers 30 days after consent; `scheduled_jobs()` (service role only) lets tests see the schedule. The CI E2E job searches the app and Supabase container logs for the test number, so a log line with a phone number fails the build.

**Timer:** the server stores `question_started_at`; phones learn the server-clock offset on join. `submit_answer()` rejects answers after `started_at + time_limit` + 1s grace.

**Scoring** (inside `submit_answer()`):
- `speed`: correct = `round(1000 × (1 − 0.5 × elapsed/limit))` (500–1000); no timer → 1000
- `points`: correct = 1000
- `results`: 0, no leaderboard

**Reconnect:** anonymous auth keeps the player's session in the browser; on reload the player row is found by `auth.uid()`.

**Projector (KQ-10):** `/host/sessions/[id]` renders `<Projector>`, which follows the session with `useLiveSession` (Realtime + 1.5s poll; `progressKey()` makes it accept only forward moves, so a late reply can't undo a newer state). The main button (and Space) calls the next legal engine function; the projector auto-reveals when the countdown (server clock via `server_time()`) hits 0 or every player answered. Option colors+shapes (`lib/answer-style.ts`) are shared with phones.

**Phones (KQ-11):** `<PlayerGame>` uses the same `useLiveSession` with `poll: false` (re-reads on `visibilitychange` instead). One tap = one answer: buttons lock before the network reply, the choice is kept in `localStorage` per question (so a reload still shows "answer received"), and `submit_answer` refuses duplicates anyway. Results come from `reveal_payload.results[playerId]`.

**Pause (KQ-13):** after a round's last question `next_question` sets `paused` and keeps `reveal_payload`, so the pause screen shows the standings from the last reveal; `round_idx` already points at the next round. The pause screen repeats the PIN/QR because new players may join during a pause (`join_session` allows `lobby` and `paused`).

**End of game (KQ-14):** `_finish()` sets `finished` and writes `sessions.final_payload` once: `ranks` per player (SQL `rank()`, ties share a rank), top-3 `podium`, `show_scores`. Reached by `next_question` after the last round or by `finish_session` (host ends early; allowed in lobby/reveal/paused, not mid-question so given answers count).

## 5. Authoring & import

- Quiz list on `/host`: start, edit (`/host/quizzes/[id]`), duplicate (`duplicate_quiz()`, security invoker: RLS applies, copy owned by the caller), delete (two-click `ConfirmButton`; cascades to rounds, questions and past sessions). Settings form validated by `lib/quiz-settings.ts` before the update (KQ-15).
- Editor (KQ-16), on the quiz page below the settings: rounds (optional title) each holding questions. "Add" inserts a valid placeholder at the end (position = max + 1), which the host then edits in place. Each question opens into a form validated by `lib/question-form.ts` (mirrors the `valid_options` CHECK: 2–4 options, true/false = fixed pair "נכון / לא נכון", exactly one correct, no duplicates; timer from a fixed list or none). Reorder with ▲/▼ buttons (not drag-and-drop: same on mouse, touch and keyboard, no library) via `move_round()` / `move_question()`: security invoker, swap positions with the nearest neighbour inside one transaction (the unique position constraints are deferred to commit). Positions may have gaps; only their order matters. Deletes use the two-click `ConfirmButton`.
- Images (KQ-17): the editor resizes in the browser (`lib/resize-image.ts`: canvas, longest side ≤ 1600px, JPEG quality 0.82 → 0.7 → 0.55 until ≤ 450 KB) and uploads straight to Supabase Storage with the host's session. Bucket `question-images`: public read (phones and projector load by URL, no login; random file names), 1 MB / image types only. Writes are RLS on `storage.objects`: host only, and only under `<quiz_id>/` of a quiz they own (`owns_quiz_folder()`). `questions.image_path` holds the path; `setQuestionImage` records it and deletes the replaced file unless another question (a duplicated quiz) still uses it. Projector and phone show it with a plain `<img>` (no Vercel image optimizer: already small, and it would count against the free plan). Known gap: deleting a quiz leaves its files in Storage (small; cleanup can come later).
- Import (KQ-18), on the quiz page: templates in `public/templates/` (`.xlsx` right-to-left with a drop-down for the type, and `.csv` UTF-8 with BOM), built by `scripts/make-import-template.py`. The browser reads the file (`read-excel-file` for xlsx, `papaparse` for csv; Hebrew-Excel CSVs in Windows-1255 are detected), `lib/quiz-import.ts` checks every row with the editor's own `parseQuestionForm` and lists all problems with their Excel row numbers; otherwise a preview. On confirm the server re-checks the raw rows and saves with `import_rounds()` (one transaction, security invoker): all or nothing, appended after the existing rounds. Max 500 questions per import.
  Columns (Hebrew titles; English also accepted): `סבב (round) | שם הסבב (round_title) | שאלה (question) | סוג (type: אמריקאית/mc, נכון/לא נכון/tf) | תשובה 1–4 (option1–4) | תשובה נכונה (correct: 1–4, or נכון/לא נכון) | זמן (שניות) (time_sec: empty or 10/15/20/30/45/60/90/120) | הסבר (explanation)`.
  Changed from the original plan: SheetJS → `read-excel-file` + `papaparse` (SheetJS's npm package is outdated; the current one is only on their CDN), and no `image_url` column (images are added in the editor, KQ-17).

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
