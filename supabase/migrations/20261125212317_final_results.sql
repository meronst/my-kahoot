-- supabase/migrations/20261125212317_final_results.sql — the end of the game: final ranks and podium (KQ-14).
--
-- When a game ends (after the last round, or when the host ends it early) the engine writes
-- sessions.final_payload once:
--   { show_scores, players, podium: [top 3], ranks: { <player_id>: { rank, score } } }
-- Phones read their own rank from it; the projector draws the podium. Like every other payload,
-- it's computed by the database so all screens agree.
--
-- Ranking: standard competition ranking (SQL rank()): equal scores share a rank and the next rank is
-- skipped (1, 1, 3). Ties are broken by nobody: two people with the same score are equally good.

alter table public.sessions add column final_payload jsonb;
comment on column public.sessions.final_payload is
  'Written when the game finishes: ranks per player, top-3 podium, whether scores are shown.';

-- Internal: mark the session finished and publish the final standings.
create or replace function public._finish(p_session_id uuid)
returns public.sessions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
  v_mode public.scoring_mode;
begin
  select qz.scoring_mode into v_mode
  from public.sessions s join public.quizzes qz on qz.id = s.quiz_id
  where s.id = p_session_id;

  with ranked as (
    select p.id, p.nickname, p.score, p.joined_at,
           rank() over (order by p.score desc)::int as rank
    from public.players p
    where p.session_id = p_session_id
  )
  update public.sessions set
    status = 'finished',
    final_payload = jsonb_build_object(
      'show_scores', v_mode <> 'results',
      'players', (select count(*) from ranked),
      'podium', case when v_mode = 'results' then '[]'::jsonb else coalesce(
        (select jsonb_agg(jsonb_build_object('player_id', r.id, 'nickname', r.nickname,
                                             'score', r.score, 'rank', r.rank)
                          order by r.rank, r.joined_at)
         from (select * from ranked order by rank, joined_at limit 3) r),
        '[]'::jsonb) end,
      'ranks', coalesce(
        (select jsonb_object_agg(r.id, jsonb_build_object('rank', r.rank, 'score', r.score)) from ranked r),
        '{}'::jsonb)
    )
  where id = p_session_id
  returning * into v_session;
  return v_session;
end;
$$;

-- Same as in the game_engine migration, except the last branch: end of the last round now goes
-- through _finish() so the final standings are published.
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

  select * into v_next from public.quiz_sequence(v_session.quiz_id) qs
   where qs.round_idx = v_session.round_idx and qs.question_idx = v_session.question_idx + 1;
  if found then
    return public._show_question(p_session_id, v_session.round_idx, v_session.question_idx + 1);
  end if;

  if exists (select 1 from public.quiz_sequence(v_session.quiz_id) qs
              where qs.round_idx = v_session.round_idx + 1) then
    update public.sessions set status = 'paused', round_idx = v_session.round_idx + 1, question_idx = 0
     where id = p_session_id returning * into v_session;
    return v_session;
  end if;

  return public._finish(p_session_id);
end;
$$;

-- Host ends the game early (e.g. the lecture ran out of time). Allowed between questions and in the
-- lobby, not in the middle of a question (reveal it first, so answers already given count).
create or replace function public.finish_session(p_session_id uuid)
returns public.sessions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.sessions := public._lock_hosted_session(p_session_id);
begin
  if v_session.status not in ('lobby', 'reveal', 'paused') then
    raise exception 'invalid_state: can''t finish during %', v_session.status;
  end if;
  return public._finish(p_session_id);
end;
$$;

revoke execute on function public._finish(uuid), public.finish_session(uuid) from public;
grant execute on function public.finish_session(uuid) to authenticated, service_role;
