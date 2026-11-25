-- supabase/migrations/20261125203029_player_join.sql — players join a session from their phones (KQ-8).
--
-- Two functions, both SECURITY DEFINER (they run with the owner's rights, bypassing RLS), because a
-- phone must learn a little about a session it hasn't joined yet. Each one is a narrow, audited door:
-- it returns or changes exactly what's needed and nothing else.
--
-- Errors are raised with short machine-readable messages ('nickname_taken', 'session_ended', ...);
-- the app maps them to Hebrew (lib/join-errors.ts). Never show raw database errors to players.

-- ─────────────────────────────────────────────────────────────────────────────
-- session_preview(pin): what the join screen may show before joining.
-- ─────────────────────────────────────────────────────────────────────────────
-- Callable by anyone with the PIN, even before signing in: returns only the quiz title, whether
-- phone numbers are collected, the status and whether joining is still possible. No questions,
-- no players.
-- A PIN is unique among sessions still in play, but a finished session may share it with a newer one,
-- so prefer the active session, then the most recent.
create or replace function public.session_preview(p_pin text)
returns table (session_id uuid, quiz_title text, collect_phone boolean, status public.session_status, is_open boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, q.title, q.collect_phone, s.status,
         (s.status <> 'finished' and s.expires_at > now()) as is_open
  from public.sessions s
  join public.quizzes q on q.id = s.quiz_id
  where s.pin = p_pin
  order by (s.status <> 'finished') desc, s.created_at desc
  limit 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- join_session(pin, nickname): the signed-in (anonymous) player joins.
-- ─────────────────────────────────────────────────────────────────────────────
-- Rules, in order:
--   1. must be signed in (the phone signs in anonymously first)
--   2. the PIN must match a session
--   3. RECONNECT: if this login already joined this session, return that same player (same name and
--      score), whatever the game state. This is how a reload or a locked phone gets back in.
--   4. a finished or expired session can't be joined
--   5. new players join only in the lobby or during a pause between rounds (requirements §6)
--   6. nickname: 1–20 characters, unique in the session
create or replace function public.join_session(p_pin text, p_nickname text)
returns public.players
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_session public.sessions;
  v_player public.players;
  v_nickname text := btrim(coalesce(p_nickname, ''));
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  select s.* into v_session
  from public.sessions s
  where s.pin = p_pin
  order by (s.status <> 'finished') desc, s.created_at desc
  limit 1;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;

  -- Reconnect: the same login already has a player here.
  select p.* into v_player
  from public.players p
  where p.session_id = v_session.id and p.user_id = v_user;
  if found then
    return v_player;
  end if;

  if v_session.status = 'finished' or v_session.expires_at <= now() then
    raise exception 'session_ended';
  end if;
  if v_session.status not in ('lobby', 'paused') then
    raise exception 'session_in_progress';
  end if;
  if char_length(v_nickname) not between 1 and 20 then
    raise exception 'nickname_invalid';
  end if;

  begin
    insert into public.players (session_id, user_id, nickname)
    values (v_session.id, v_user, v_nickname)
    returning * into v_player;
  exception when unique_violation then
    -- players_session_nickname_key: someone in this session already uses this name.
    raise exception 'nickname_taken';
  end;

  return v_player;
end;
$$;

-- Grants (KQ-29 rule: grant exactly what each function needs).
revoke execute on function public.session_preview(text), public.join_session(text, text) from public;
grant execute on function public.session_preview(text) to anon, authenticated, service_role;
grant execute on function public.join_session(text, text) to authenticated, service_role;
