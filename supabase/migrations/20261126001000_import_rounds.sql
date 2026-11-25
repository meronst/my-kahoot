-- supabase/migrations/20261126001000_import_rounds.sql — save an imported spreadsheet in one go (KQ-18).
--
-- Why a function: the import must be all-or-nothing. A function body runs in ONE transaction, so if
-- any insert fails (a CHECK constraint, a lost connection), every round and question it added is
-- rolled back — like a @Transactional method in Spring.
--
-- SECURITY INVOKER: RLS applies, so a host can only add to their own quizzes.
-- p_rounds: [{ "title": text|null, "questions": [{ type, text, options, time_limit_sec, explanation }] }]
-- New rounds go after the quiz's existing ones. Returns how many questions were added.

create or replace function public.import_rounds(p_quiz_id uuid, p_rounds jsonb)
returns int
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_next int;
  v_round jsonb;
  v_round_id uuid;
  v_count int := 0;
begin
  if not exists (select 1 from public.quizzes where id = p_quiz_id) then
    raise exception 'quiz_not_found'; -- missing, or not yours (RLS hides it)
  end if;
  if jsonb_typeof(p_rounds) is distinct from 'array' or jsonb_array_length(p_rounds) = 0 then
    raise exception 'nothing_to_import';
  end if;

  select coalesce(max(r.position) + 1, 0) into v_next from public.rounds r where r.quiz_id = p_quiz_id;

  for v_round in select value from jsonb_array_elements(p_rounds) loop
    insert into public.rounds (quiz_id, position, title)
    values (p_quiz_id, v_next, nullif(v_round ->> 'title', ''))
    returning id into v_round_id;
    v_next := v_next + 1;

    insert into public.questions (round_id, position, type, text, options, time_limit_sec, explanation)
    select v_round_id,
           q.ord - 1,
           (q.value ->> 'type')::public.question_type,
           q.value ->> 'text',
           q.value -> 'options',
           (q.value ->> 'time_limit_sec')::int,
           nullif(q.value ->> 'explanation', '')
    from jsonb_array_elements(v_round -> 'questions') with ordinality as q(value, ord);
    v_count := v_count + (select count(*) from jsonb_array_elements(v_round -> 'questions'));
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.import_rounds(uuid, jsonb) from public;
grant execute on function public.import_rounds(uuid, jsonb) to authenticated, service_role;
