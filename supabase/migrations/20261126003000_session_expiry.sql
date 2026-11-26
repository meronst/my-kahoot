-- supabase/migrations/20261126003000_session_expiry.sql — sessions end on their own after 24 hours (KQ-21).
--
-- A session lives 24 hours (sessions.expires_at, set at creation): long enough for a lecture with
-- breaks, short enough that an old PIN can't be reused by accident. Joining an expired session was
-- already refused (join_session, KQ-8). This adds the cleanup: every 15 minutes, any session past its
-- time that isn't finished is finished properly (_finish computes the final ranking), so the
-- projector, phones and the host see "the quiz has ended" instead of a game frozen in the middle.

create or replace function public.expire_sessions()
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count int := 0;
begin
  for v_id in
    select s.id from public.sessions s
    where s.status <> 'finished' and s.expires_at <= now()
    for update skip locked   -- a host move in progress on the same row: catch it next time
  loop
    perform public._finish(v_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.expire_sessions() from public;
grant execute on function public.expire_sessions() to service_role;

-- pg_cron (enabled in KQ-19): every 15 minutes.
select cron.schedule('expire-sessions', '*/15 * * * *', 'select public.expire_sessions()');
