-- supabase/migrations/20261125214159_reorder.sql — move a round or a question up/down (KQ-16).
--
-- Moving = swapping `position` with the neighbour above or below. Two UPDATEs that must happen
-- together, so they live in one function (one transaction). The unique (parent, position)
-- constraints are DEFERRABLE INITIALLY DEFERRED (game_schema migration), so the moment in between,
-- when both rows briefly share a position, is allowed; uniqueness is checked at commit.
--
-- SECURITY INVOKER: RLS applies, so a host can only move items in their own quizzes.
-- Positions may have gaps after deletions (0, 2, 5): only the order matters, so "neighbour" means the
-- next smaller/larger position, not position ± 1.

create or replace function public.move_round(p_round_id uuid, p_direction int)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_round public.rounds;
  v_other public.rounds;
begin
  if p_direction not in (-1, 1) then
    raise exception 'invalid_direction';
  end if;
  select r.* into v_round from public.rounds r where r.id = p_round_id;
  if not found then
    raise exception 'round_not_found';
  end if;

  select r.* into v_other from public.rounds r
  where r.quiz_id = v_round.quiz_id
    and case when p_direction < 0 then r.position < v_round.position else r.position > v_round.position end
  order by case when p_direction < 0 then -r.position else r.position end
  limit 1;
  if not found then
    return; -- already first/last: nothing to do
  end if;

  update public.rounds set position = v_other.position where id = v_round.id;
  update public.rounds set position = v_round.position where id = v_other.id;
end;
$$;

create or replace function public.move_question(p_question_id uuid, p_direction int)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_question public.questions;
  v_other public.questions;
begin
  if p_direction not in (-1, 1) then
    raise exception 'invalid_direction';
  end if;
  select q.* into v_question from public.questions q where q.id = p_question_id;
  if not found then
    raise exception 'question_not_found';
  end if;

  select q.* into v_other from public.questions q
  where q.round_id = v_question.round_id
    and case when p_direction < 0 then q.position < v_question.position else q.position > v_question.position end
  order by case when p_direction < 0 then -q.position else q.position end
  limit 1;
  if not found then
    return;
  end if;

  update public.questions set position = v_other.position where id = v_question.id;
  update public.questions set position = v_question.position where id = v_other.id;
end;
$$;

revoke execute on function public.move_round(uuid, int), public.move_question(uuid, int) from public;
grant execute on function public.move_round(uuid, int), public.move_question(uuid, int) to authenticated, service_role;
