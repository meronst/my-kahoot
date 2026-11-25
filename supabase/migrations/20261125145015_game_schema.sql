-- supabase/migrations/20261125145015_game_schema.sql — the game's tables and their security rules (KQ-5).
--
-- Read this top to bottom: types → helper functions → tables → Row Level Security (RLS) policies.
--
-- Concept — Row Level Security (RLS):
--   Normally a database user either can or can't read a table. With RLS, Postgres filters ROWS per
--   request: every query gets an invisible `WHERE <policy>` added. Here the "user" is whoever's token
--   came with the HTTP request (auth.uid()), so the same `select * from questions` returns the host's
--   questions to the host and nothing at all to a player. It's enforced in the database, so no bug in
--   the browser code can bypass it.
--   Once RLS is enabled on a table, the default is DENY: no policy, no rows.
--
-- Who is who:
--   - Host: a signed-in, NON-anonymous user (email + password, KQ-6). Owns quizzes via owner_id.
--   - Player: an ANONYMOUS signed-in user (Supabase "anonymous sign-in", KQ-8): has an id, no email.
--   - Writes that players make (join, answer) will go through Postgres functions in KQ-8/KQ-9,
--     so this migration gives players read access only, and only to their own data.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Types
-- ─────────────────────────────────────────────────────────────────────────────

-- Concept — enum: a fixed list of allowed values (like a Java enum). The DB rejects anything else.
create type public.scoring_mode as enum ('speed', 'points', 'results');
create type public.question_type as enum ('mc', 'tf');  -- multiple choice / true-false
create type public.session_status as enum ('lobby', 'question', 'reveal', 'paused', 'finished');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Helper functions
-- ─────────────────────────────────────────────────────────────────────────────

-- True when the caller is a real (non-anonymous) signed-in user, i.e. the host.
-- auth.jwt() is the decoded login token; Supabase puts `is_anonymous: true` in it for players.
create or replace function public.is_host()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

-- Validates a question's answer options (used by a CHECK constraint on questions.options):
--   - a JSON array of { "text": "...", "correct": true|false }
--   - true/false questions: exactly 2 options; multiple choice: 2 to 4
--   - exactly ONE option marked correct, and no empty texts
-- `immutable` = same input always gives the same output; required for use in a CHECK constraint.
create or replace function public.valid_options(qtype public.question_type, opts jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(opts) = 'array'
     and case when qtype = 'tf' then jsonb_array_length(opts) = 2
              else jsonb_array_length(opts) between 2 and 4 end
     and (select count(*) from jsonb_array_elements(opts) as e
           where (e ->> 'correct')::boolean is true) = 1
     and not exists (select 1 from jsonb_array_elements(opts) as e
                      where coalesce(btrim(e ->> 'text'), '') = '');
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tables
-- ─────────────────────────────────────────────────────────────────────────────

create table public.quizzes (
  id            uuid primary key default gen_random_uuid(),
  -- default auth.uid(): when the host inserts a quiz, they automatically become its owner.
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null check (btrim(title) <> ''),
  scoring_mode  public.scoring_mode not null default 'speed',
  collect_phone boolean not null default false,
  created_at    timestamptz not null default now()
);

create table public.rounds (
  id        uuid primary key default gen_random_uuid(),
  quiz_id   uuid not null references public.quizzes (id) on delete cascade,
  position  int  not null check (position >= 0),
  title     text,
  -- DEFERRABLE: uniqueness is checked at COMMIT, not per statement, so reordering
  -- (swapping positions 1 and 2) works inside one transaction.
  constraint rounds_quiz_position_key unique (quiz_id, position) deferrable initially deferred
);

create table public.questions (
  id             uuid primary key default gen_random_uuid(),
  round_id       uuid not null references public.rounds (id) on delete cascade,
  position       int  not null check (position >= 0),
  type           public.question_type not null,
  text           text not null check (btrim(text) <> ''),
  image_path     text,
  time_limit_sec int check (time_limit_sec is null or time_limit_sec between 5 and 300),  -- null = no timer
  explanation    text,
  options        jsonb not null,
  constraint questions_options_valid check (public.valid_options(type, options)),
  constraint questions_round_position_key unique (round_id, position) deferrable initially deferred
);

create table public.sessions (
  id                  uuid primary key default gen_random_uuid(),
  quiz_id             uuid not null references public.quizzes (id) on delete cascade,
  pin                 text not null check (pin ~ '^[0-9]{6}$'),
  status              public.session_status not null default 'lobby',
  round_idx           int not null default 0,
  question_idx        int not null default 0,
  question_started_at timestamptz,
  question_payload    jsonb,   -- what phones see: question WITHOUT the correct flags (filled by KQ-9)
  reveal_payload      jsonb,   -- distribution, correct option, scores (filled by KQ-9)
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default now() + interval '24 hours'
);
-- A PIN must be unique among sessions still in play; finished ones can reuse it.
-- (Partial unique index: the uniqueness rule applies only to rows matching the WHERE.)
create unique index sessions_active_pin_key on public.sessions (pin) where status <> 'finished';
create index sessions_quiz_id_idx on public.sessions (quiz_id);

create table public.players (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.sessions (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,  -- the anonymous login
  nickname         text not null check (char_length(btrim(nickname)) between 1 and 20),
  phone            text,           -- optional, only when the quiz collects it; deleted after 30 days (KQ-19)
  phone_consent_at timestamptz,
  score            int not null default 0,
  joined_at        timestamptz not null default now(),
  constraint players_session_nickname_key unique (session_id, nickname),
  constraint players_session_user_key unique (session_id, user_id)   -- one player per login per session
);

create table public.answers (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  option_idx  int  not null check (option_idx between 0 and 3),
  answered_at timestamptz not null default now(),
  is_correct  boolean not null,
  points      int not null default 0,
  constraint answers_player_question_key unique (player_id, question_id)  -- one answer per question
);
create index answers_session_question_idx on public.answers (session_id, question_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Ownership helpers used by policies
-- ─────────────────────────────────────────────────────────────────────────────
-- Why SECURITY DEFINER here: a policy on `players` that reads `sessions`, whose own policy reads
-- `players`, would loop forever ("infinite recursion detected in policy"). These functions run with
-- the owner's rights, so their lookups skip RLS and break the loop. They only return true/false
-- about the CALLER (auth.uid()), so they leak nothing.

create or replace function public.owns_session(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_host() and exists (
    select 1 from public.sessions s
    join public.quizzes q on q.id = s.quiz_id
    where s.id = sid and q.owner_id = auth.uid()
  );
$$;

create or replace function public.is_player_in(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.players p
    where p.session_id = sid and p.user_id = auth.uid()
  );
$$;

-- Functions are callable by everyone by default; keep these to logged-in users only.
revoke execute on function public.owns_session(uuid), public.is_player_in(uuid) from public, anon;
grant execute on function public.owns_session(uuid), public.is_player_in(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
-- `(select auth.uid())` instead of `auth.uid()`: Postgres evaluates it once per query instead of
-- once per row. Same result, much faster on big tables (Supabase's recommended pattern).

alter table public.quizzes   enable row level security;
alter table public.rounds    enable row level security;
alter table public.questions enable row level security;
alter table public.sessions  enable row level security;
alter table public.players   enable row level security;
alter table public.answers   enable row level security;

-- Not-logged-in visitors get nothing from these tables, ever.
revoke all on public.quizzes, public.rounds, public.questions,
              public.sessions, public.players, public.answers from anon;

-- quizzes: the host has full access to their own quizzes. Players: no access.
create policy quizzes_host_all on public.quizzes
  for all to authenticated
  using      (owner_id = (select auth.uid()) and (select public.is_host()))
  with check (owner_id = (select auth.uid()) and (select public.is_host()));

-- rounds: through the quiz they belong to.
create policy rounds_host_all on public.rounds
  for all to authenticated
  using (exists (select 1 from public.quizzes q
                 where q.id = quiz_id and q.owner_id = (select auth.uid()))
         and (select public.is_host()))
  with check (exists (select 1 from public.quizzes q
                      where q.id = quiz_id and q.owner_id = (select auth.uid()))
              and (select public.is_host()));

-- questions: through round → quiz. Players NEVER read this table: it contains the answer keys.
create policy questions_host_all on public.questions
  for all to authenticated
  using (exists (select 1 from public.rounds r join public.quizzes q on q.id = r.quiz_id
                 where r.id = round_id and q.owner_id = (select auth.uid()))
         and (select public.is_host()))
  with check (exists (select 1 from public.rounds r join public.quizzes q on q.id = r.quiz_id
                      where r.id = round_id and q.owner_id = (select auth.uid()))
              and (select public.is_host()));

-- sessions: the host manages sessions of their own quizzes...
create policy sessions_host_all on public.sessions
  for all to authenticated
  using (exists (select 1 from public.quizzes q
                 where q.id = quiz_id and q.owner_id = (select auth.uid()))
         and (select public.is_host()))
  with check (exists (select 1 from public.quizzes q
                      where q.id = quiz_id and q.owner_id = (select auth.uid()))
              and (select public.is_host()));
-- ...and a player may READ the session they joined (status, current question payload, results).
create policy sessions_player_read on public.sessions
  for select to authenticated
  using (public.is_player_in(id));

-- players: a player reads only their own row; the host reads all players of their sessions.
-- No insert/update policy: joining and scoring happen in Postgres functions (KQ-8, KQ-9).
create policy players_read_own_or_host on public.players
  for select to authenticated
  using (user_id = (select auth.uid()) or public.owns_session(session_id));

-- answers: only the host reads them (for live counts). Players never read the answers table:
-- they learn their own result from sessions.reveal_payload. Inserts only via submit_answer() (KQ-9).
create policy answers_host_read on public.answers
  for select to authenticated
  using (public.owns_session(session_id));
