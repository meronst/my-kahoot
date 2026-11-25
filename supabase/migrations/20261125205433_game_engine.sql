-- supabase/migrations/20261125205433_game_engine.sql — the game engine (KQ-9).
--
-- "The database is the referee": every move in the game is one of these functions. Each checks who's
-- calling and whether the move is legal right now, then writes the new state. Realtime pushes the
-- changed `sessions` row to every phone. The browser never decides anything that matters.
--
-- State machine (sessions.status):
--   lobby ──start_session──► question ──reveal_question──► reveal ──next_question──► question …
--                                                             │ end of a round      → paused
--                                                             │ end of the last one → finished
--   paused ──resume_session──► question (first question of the next round)
--
-- Concept — row locking (`select ... for update`): two clicks on "next" arriving together would both
-- read status = 'reveal' and both advance, skipping a question. Locking the session row makes the
-- second call wait for the first to commit, then see the new status and be refused.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The quiz as one ordered sequence of questions
-- ─────────────────────────────────────────────────────────────────────────────
-- round_idx / question_idx are 0-based positions in play order. Rounds without questions are skipped
-- (the join drops them), so indexes always point at a real question.
create or replace function public.quiz_sequence(p_quiz_id uuid)
returns table (round_idx int, question_idx int, question_id uuid, round_count int, round_size int)
language sql
stable
security definer
set search_path = ''
as $$
  with ordered as (
    select (dense_rank() over (order by r.position) - 1)::int as round_idx,
           (row_number() over (partition by r.id order by q.position) - 1)::int as question_idx,
           q.id as question_id,
           r.id as round_id
    from public.rounds r
    join public.questions q on q.round_id = r.id
    where r.quiz_id = p_quiz_id
  )
  select o.round_idx, o.question_idx, o.question_id,
         (select count(distinct round_id) from ordered)::int as round_count,
         (count(*) over (partition by o.round_id))::int as round_size
  from ordered o
  order by o.round_idx, o.question_idx;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Scoring (one formula, also mirrored in lib/scoring.ts and tested for equality)
-- ─────────────────────────────────────────────────────────────────────────────
--   speed:   correct → 1000 × (1 − 0.5 × elapsed/limit), i.e. 1000 (instant) down to 500 (last moment);
--            no timer → 1000
--   points:  correct → 1000
--   results: always 0 (no scores shown)
--   wrong answer: 0 in every mode
create or replace function public.score_answer(
  p_mode public.scoring_mode, p_correct boolean, p_elapsed_ms int, p_limit_sec int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when not p_correct or p_mode = 'results' then 0
    when p_mode = 'points' or p_limit_sec is null then 1000
    else round(1000 * (1 - 0.5 * least(greatest(p_elapsed_ms, 0), p_limit_sec * 1000)::numeric
                                 / (p_limit_sec * 1000)))::int
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Internal: show question (round, idx) — builds the payload phones are allowed to see
-- ─────────────────────────────────────────────────────────────────────────────
-- Leading underscore = internal helper: not granted to any API role, only called by the functions below.
-- The payload has the option TEXTS only, never the `correct` flags, and no explanation (that's for the reveal).
create or replace function public._show_question(p_session_id uuid, p_round int, p_idx int)
returns public.sessions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
  v_seq record;
  v_question public.questions;
begin
  select s.* into v_session from public.sessions s where s.id = p_session_id;
  select * into v_seq from public.quiz_sequence(v_session.quiz_id) qs
   where qs.round_idx = p_round and qs.question_idx = p_idx;
  if not found then
    raise exception 'question_not_found';
  end if;
  select q.* into v_question from public.questions q where q.id = v_seq.question_id;

  update public.sessions set
    status = 'question',
    round_idx = p_round,
    question_idx = p_idx,
    question_started_at = now(),
    reveal_payload = null,
    question_payload = jsonb_build_object(
      'question_id', v_question.id,
      'round_idx', p_round,
      'round_count', v_seq.round_count,
      'question_idx', p_idx,
      'round_size', v_seq.round_size,
      'type', v_question.type,
      'text', v_question.text,
      'image_path', v_question.image_path,
      'time_limit_sec', v_question.time_limit_sec,
      'options', (select jsonb_agg(o ->> 'text' order by ord)
                  from jsonb_array_elements(v_question.options) with ordinality as e(o, ord))
    )
  where id = p_session_id
  returning * into v_session;
  return v_session;
end;
$$;

-- Locks the session and checks the caller is its host. Returns the locked row.
create or replace function public._lock_hosted_session(p_session_id uuid)
returns public.sessions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
begin
  if not public.owns_session(p_session_id) then
    raise exception 'not_your_session' using errcode = '42501';
  end if;
  select s.* into v_session from public.sessions s where s.id = p_session_id for update;
  return v_session;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Host moves
-- ─────────────────────────────────────────────────────────────────────────────

-- lobby → first question of the first round.
create or replace function public.start_session(p_session_id uuid)
returns public.sessions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.sessions := public._lock_hosted_session(p_session_id);
begin
  if v_session.status <> 'lobby' then
    raise exception 'invalid_state: expected lobby, got %', v_session.status;
  end if;
  if not exists (select 1 from public.quiz_sequence(v_session.quiz_id)) then
    raise exception 'quiz_has_no_questions';
  end if;
  return public._show_question(p_session_id, 0, 0);
end;
$$;

-- question → reveal: closes answering and publishes the results.
-- reveal_payload: correct option, explanation, answer counts per option, top 5, and every player's
-- score + points for this question (keyed by player id), so phones need no second request.
create or replace function public.reveal_question(p_session_id uuid)
returns public.sessions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.sessions := public._lock_hosted_session(p_session_id);
  v_question public.questions;
  v_mode public.scoring_mode;
  v_question_id uuid;
begin
  if v_session.status <> 'question' then
    raise exception 'invalid_state: expected question, got %', v_session.status;
  end if;
  v_question_id := (v_session.question_payload ->> 'question_id')::uuid;
  select q.* into v_question from public.questions q where q.id = v_question_id;
  select qz.scoring_mode into v_mode from public.quizzes qz where qz.id = v_session.quiz_id;

  update public.sessions set
    status = 'reveal',
    reveal_payload = jsonb_build_object(
      'question_id', v_question_id,
      'correct_idx', (select (ord - 1)::int
                      from jsonb_array_elements(v_question.options) with ordinality as e(o, ord)
                      where (o ->> 'correct')::boolean limit 1),
      'explanation', v_question.explanation,
      'counts', (select jsonb_agg(
                   (select count(*) from public.answers a
                     where a.session_id = p_session_id and a.question_id = v_question_id
                       and a.option_idx = i)
                   order by i)
                 from generate_series(0, jsonb_array_length(v_question.options) - 1) as i),
      'answered', (select count(*) from public.answers a
                    where a.session_id = p_session_id and a.question_id = v_question_id),
      'players', (select count(*) from public.players p where p.session_id = p_session_id),
      'show_scores', v_mode <> 'results',
      'leaderboard', case when v_mode = 'results' then '[]'::jsonb else coalesce(
        (select jsonb_agg(jsonb_build_object('player_id', t.id, 'nickname', t.nickname, 'score', t.score)
                          order by t.score desc, t.joined_at)
         from (select p.id, p.nickname, p.score, p.joined_at from public.players p
               where p.session_id = p_session_id order by p.score desc, p.joined_at limit 5) t),
        '[]'::jsonb) end,
      'results', coalesce(
        (select jsonb_object_agg(p.id, jsonb_build_object(
                   'score', p.score,
                   'points', coalesce(a.points, 0),
                   'correct', a.is_correct))       -- null = didn't answer
         from public.players p
         left join public.answers a
           on a.player_id = p.id and a.question_id = v_question_id
         where p.session_id = p_session_id),
        '{}'::jsonb)
    )
  where id = p_session_id
  returning * into v_session;
  return v_session;
end;
$$;

-- reveal → next question in this round, or → paused (end of round), or → finished (end of quiz).
create or replace function public.next_question(p_session_id uuid)
returns public.sessions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.sessions := public._lock_hosted_session(p_session_id);
  v_next record;
begin
  if v_session.status <> 'reveal' then
    raise exception 'invalid_state: expected reveal, got %', v_session.status;
  end if;

  -- Next question in the same round?
  select * into v_next from public.quiz_sequence(v_session.quiz_id) qs
   where qs.round_idx = v_session.round_idx and qs.question_idx = v_session.question_idx + 1;
  if found then
    return public._show_question(p_session_id, v_session.round_idx, v_session.question_idx + 1);
  end if;

  -- End of round: another round left → pause (round_idx points at the round to resume with).
  if exists (select 1 from public.quiz_sequence(v_session.quiz_id) qs
              where qs.round_idx = v_session.round_idx + 1) then
    update public.sessions set status = 'paused', round_idx = v_session.round_idx + 1, question_idx = 0
     where id = p_session_id returning * into v_session;
    return v_session;
  end if;

  -- End of the last round.
  update public.sessions set status = 'finished' where id = p_session_id returning * into v_session;
  return v_session;
end;
$$;

-- paused → first question of the next round (round_idx was set when pausing).
create or replace function public.resume_session(p_session_id uuid)
returns public.sessions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.sessions := public._lock_hosted_session(p_session_id);
begin
  if v_session.status <> 'paused' then
    raise exception 'invalid_state: expected paused, got %', v_session.status;
  end if;
  return public._show_question(p_session_id, v_session.round_idx, 0);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Player move: submit_answer
-- ─────────────────────────────────────────────────────────────────────────────
-- Accepts or refuses the answer and scores it server-side. Returns only {accepted: true}: whether it
-- was CORRECT is not revealed until the host reveals (reveal_payload), so a phone can't learn the key
-- by answering and reading the reply.
-- Deadline: started_at + time limit + 1s grace for network delay. The clock is the database's, so a
-- phone with a wrong clock can't cheat.
create or replace function public.submit_answer(p_session_id uuid, p_option_idx int)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_player public.players;
  v_session public.sessions;
  v_question public.questions;
  v_mode public.scoring_mode;
  v_elapsed_ms int;
  v_correct boolean;
  v_points int;
begin
  select p.* into v_player from public.players p
   where p.session_id = p_session_id and p.user_id = auth.uid();
  if not found then
    raise exception 'not_a_player' using errcode = '42501';
  end if;

  -- Shared lock: many players answer at once (no blocking each other), but a host move that takes the
  -- exclusive lock (reveal) waits until in-flight answers are saved, and vice versa.
  select s.* into v_session from public.sessions s where s.id = p_session_id for share;
  if v_session.status <> 'question' then
    raise exception 'not_accepting_answers';
  end if;

  select q.* into v_question from public.questions q
   where q.id = (v_session.question_payload ->> 'question_id')::uuid;
  if p_option_idx is null or p_option_idx < 0 or p_option_idx >= jsonb_array_length(v_question.options) then
    raise exception 'invalid_option';
  end if;

  v_elapsed_ms := (extract(epoch from (clock_timestamp() - v_session.question_started_at)) * 1000)::int;
  if v_question.time_limit_sec is not null and v_elapsed_ms > (v_question.time_limit_sec + 1) * 1000 then
    raise exception 'too_late';
  end if;

  v_correct := coalesce((v_question.options -> p_option_idx ->> 'correct')::boolean, false);
  select qz.scoring_mode into v_mode from public.quizzes qz where qz.id = v_session.quiz_id;
  v_points := public.score_answer(v_mode, v_correct, v_elapsed_ms, v_question.time_limit_sec);

  begin
    insert into public.answers (session_id, player_id, question_id, option_idx, is_correct, points)
    values (p_session_id, v_player.id, v_question.id, p_option_idx, v_correct, v_points);
  exception when unique_violation then
    raise exception 'already_answered';
  end;
  update public.players set score = score + v_points where id = v_player.id;

  return jsonb_build_object('accepted', true);
end;
$$;

-- The database's current time, so phones can correct their countdown for a wrong clock (KQ-11).
create or replace function public.server_time()
returns timestamptz
language sql
volatile
set search_path = ''
as $$ select clock_timestamp(); $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Realtime and grants (KQ-29 rule)
-- ─────────────────────────────────────────────────────────────────────────────
-- answers: the projector shows a live "N answered" counter (RLS: host only).
alter publication supabase_realtime add table public.answers;

revoke execute on function
  public.quiz_sequence(uuid), public.score_answer(public.scoring_mode, boolean, int, int),
  public._show_question(uuid, int, int), public._lock_hosted_session(uuid),
  public.start_session(uuid), public.reveal_question(uuid), public.next_question(uuid),
  public.resume_session(uuid), public.submit_answer(uuid, int), public.server_time()
from public;

grant execute on function
  public.start_session(uuid), public.reveal_question(uuid), public.next_question(uuid),
  public.resume_session(uuid), public.submit_answer(uuid, int), public.server_time()
to authenticated, service_role;
grant execute on function public.score_answer(public.scoring_mode, boolean, int, int) to authenticated, service_role;
grant execute on function public.quiz_sequence(uuid) to service_role;
