-- supabase/migrations/20261125213227_duplicate_quiz.sql — copy a quiz with all its rounds and questions (KQ-15).
--
-- Use case: reuse last month's lecture quiz as the base for a new one, without retyping it.
--
-- SECURITY INVOKER: runs with the host's own permissions, so RLS applies to every read and insert.
-- A host can only copy quizzes they can read (their own), and the copy is owned by them
-- (quizzes.owner_id defaults to auth.uid()).
--
-- Rounds get new ids, so each copied question must point at the NEW id of its round. A temporary
-- mapping (old round id → new round id) is built while copying the rounds.
create or replace function public.duplicate_quiz(p_quiz_id uuid)
returns public.quizzes
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_source public.quizzes;
  v_copy public.quizzes;
  v_round record;
  v_new_round_id uuid;
begin
  select q.* into v_source from public.quizzes q where q.id = p_quiz_id;
  if not found then
    raise exception 'quiz_not_found';  -- missing, or not this host's (RLS hides it)
  end if;

  insert into public.quizzes (title, scoring_mode, collect_phone)
  values (left('עותק של ' || v_source.title, 200), v_source.scoring_mode, v_source.collect_phone)
  returning * into v_copy;

  for v_round in select r.* from public.rounds r where r.quiz_id = p_quiz_id order by r.position loop
    insert into public.rounds (quiz_id, position, title)
    values (v_copy.id, v_round.position, v_round.title)
    returning id into v_new_round_id;

    insert into public.questions (round_id, position, type, text, image_path, time_limit_sec, explanation, options)
    select v_new_round_id, q.position, q.type, q.text, q.image_path, q.time_limit_sec, q.explanation, q.options
    from public.questions q
    where q.round_id = v_round.id;
  end loop;

  return v_copy;
end;
$$;

revoke execute on function public.duplicate_quiz(uuid) from public;
grant execute on function public.duplicate_quiz(uuid) to authenticated, service_role;
