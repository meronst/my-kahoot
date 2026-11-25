-- supabase/migrations/20261125184420_create_session.sql — starting a live session, and live updates (KQ-7).

-- ─────────────────────────────────────────────────────────────────────────────
-- create_session(quiz_id): the host starts a quiz → a new session with a unique 6-digit PIN.
-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY INVOKER: runs with the caller's own permissions, so the RLS policies from KQ-5 decide
-- whether the insert is allowed (only the host who owns the quiz). The function adds what a plain
-- insert can't do safely: pick a random PIN and retry if it collides with a session still in play.
--
-- Concept — PL/pgSQL: Postgres's procedural language (loops, variables, exceptions), used when one
-- SQL statement isn't enough. Roughly a stored procedure.
create or replace function public.create_session(p_quiz_id uuid)
returns public.sessions
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  new_session public.sessions;
  attempt int := 0;
begin
  if not public.is_host() then
    raise exception 'only the host can start a session' using errcode = '42501';  -- insufficient_privilege
  end if;

  loop
    attempt := attempt + 1;
    begin
      insert into public.sessions (quiz_id, pin)
      -- 100000..999999: always 6 digits, never a leading zero (easier to read aloud).
      values (p_quiz_id, (100000 + floor(random() * 900000))::int::text)
      returning * into new_session;
      return new_session;
    exception
      -- Another active session already uses this PIN (sessions_active_pin_key): try another one.
      when unique_violation then
        if attempt >= 20 then
          raise exception 'could not find a free PIN after % attempts', attempt;
        end if;
    end;
  end loop;
end;
$$;

comment on function public.create_session(uuid) is
  'Host only: creates a session for one of the host''s quizzes with a unique 6-digit PIN (status lobby).';

revoke execute on function public.create_session(uuid) from public, anon;
grant execute on function public.create_session(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime: which tables broadcast their changes.
-- ─────────────────────────────────────────────────────────────────────────────
-- Concept — Supabase Realtime (postgres_changes):
--   Postgres writes every change to its log; Supabase reads that log and pushes INSERT/UPDATE/DELETE
--   events over WebSockets to subscribed browsers. A table only broadcasts if it's in the
--   `supabase_realtime` publication. Each subscriber gets only the rows its RLS policies allow, so the
--   host's lobby hears about players joining its session and nobody else's.
--   players: the lobby shows players as they join (KQ-7).
--   sessions: phones follow the game state (KQ-8/KQ-9).
alter publication supabase_realtime add table public.players, public.sessions;
