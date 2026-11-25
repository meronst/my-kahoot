-- supabase/migrations/20261126002000_phone_numbers.sql — optional phone numbers (KQ-19).
--
-- Privacy rules (requirements §2, Israel's Privacy Protection Law):
--   - asked only when the quiz has collect_phone = true, and never required
--   - stored with the moment of consent (phone_consent_at); the join screen shows the consent line
--   - readable only by the player themselves and the host (players RLS, unchanged)
--   - deleted automatically 30 days after consent, by a daily pg_cron job

-- ─────────────────────────────────────────────────────────────────────────────
-- normalize_phone(text): Israeli mobile number → "05XXXXXXXX", or null if it isn't one.
-- Accepts spaces, dashes, dots, brackets and +972 / 972. Mirrors lib/phone.ts (unit-tested there).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  with digits as (
    select regexp_replace(coalesce(p_phone, ''), '[\s\-\.\(\)]', '', 'g') as d
  ), local as (
    select case
      when d ~ '^\+9725\d{8}$' then '0' || substr(d, 5)
      when d ~ '^9725\d{8}$'   then '0' || substr(d, 4)
      else d
    end as d
    from digits
  )
  select case when d ~ '^05\d{8}$' then d end from local;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- join_session(pin, nickname, phone): as in KQ-8, plus the optional phone.
-- The old 2-argument version is dropped: keeping both would make a 2-argument call ambiguous.
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.join_session(text, text);

create or replace function public.join_session(p_pin text, p_nickname text, p_phone text default null)
returns public.players
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_session public.sessions;
  v_collect boolean;
  v_player public.players;
  v_nickname text := btrim(coalesce(p_nickname, ''));
  v_phone text;
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

  select p.* into v_player
  from public.players p
  where p.session_id = v_session.id and p.user_id = v_user;
  if found then
    return v_player; -- reconnect: same player, phone untouched
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

  -- The phone is kept only if this quiz asks for it; an empty field means "no thanks".
  select q.collect_phone into v_collect from public.quizzes q where q.id = v_session.quiz_id;
  if v_collect and btrim(coalesce(p_phone, '')) <> '' then
    v_phone := public.normalize_phone(p_phone);
    if v_phone is null then
      raise exception 'phone_invalid';
    end if;
  end if;

  begin
    insert into public.players (session_id, user_id, nickname, phone, phone_consent_at)
    values (v_session.id, v_user, v_nickname, v_phone, case when v_phone is not null then now() end)
    returning * into v_player;
  exception when unique_violation then
    raise exception 'nickname_taken';
  end;

  return v_player;
end;
$$;

revoke execute on function public.join_session(text, text, text) from public;
grant execute on function public.join_session(text, text, text) to authenticated, service_role;
revoke execute on function public.normalize_phone(text) from public;
grant execute on function public.normalize_phone(text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- delete_expired_phones(): erase numbers 30 days after consent. Returns how many were erased.
-- Only the database itself (cron) and the service role may run it.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.delete_expired_phones()
returns int
language sql
volatile
security definer
set search_path = ''
as $$
  with erased as (
    update public.players
       set phone = null, phone_consent_at = null
     where phone is not null and phone_consent_at < now() - interval '30 days'
    returning 1
  )
  select count(*)::int from erased;
$$;
revoke execute on function public.delete_expired_phones() from public;
grant execute on function public.delete_expired_phones() to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Daily job. Concept — pg_cron: a scheduler INSIDE Postgres (like a crontab or a Spring @Scheduled
-- method), so no server of ours has to stay awake. 03:17 UTC, a quiet time.
-- cron.schedule with an existing job name updates that job, so re-running this is safe.
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('delete-expired-phones', '17 3 * * *', 'select public.delete_expired_phones()');

-- scheduled_jobs(): lets tests (service role) check which cron jobs exist; the cron schema itself
-- isn't exposed through the API.
create or replace function public.scheduled_jobs()
returns table (jobname text, schedule text, command text, active boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select j.jobname::text, j.schedule::text, j.command::text, j.active from cron.job j order by j.jobname;
$$;
revoke execute on function public.scheduled_jobs() from public;
grant execute on function public.scheduled_jobs() to service_role;
