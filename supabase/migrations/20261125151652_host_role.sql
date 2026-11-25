-- supabase/migrations/20261125151652_host_role.sql — only an explicitly marked account is a host (KQ-6).
--
-- Before: is_host() = "signed in and not anonymous". But sign-ups must stay enabled, because players
-- sign in anonymously and Supabase counts every anonymous player as a new sign-up. So anyone could
-- register an email account and become a "host" (with an empty space of their own, but still able to
-- create quizzes and store data). See docs/decisions/0003-host-role.md.
--
-- After: is_host() = "the login token says app_metadata.role = 'host'".
--
-- Concept — app_metadata vs user_metadata:
--   Supabase gives every user two JSON bags. user_metadata can be edited by the user themselves
--   (name, avatar...). app_metadata can only be changed with the admin (secret) key or SQL, so it's the
--   right place for roles. Its contents are copied into the login token (JWT), so checking it costs
--   nothing at query time.
--
-- How Meron's account becomes the host (once, in the Supabase SQL editor):
--   update auth.users
--   set raw_app_meta_data = raw_app_meta_data || '{"role":"host"}'
--   where email = '<host email>';
-- The change takes effect on the next login (the token is re-issued).

create or replace function public.is_host()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     and (auth.jwt() -> 'app_metadata' ->> 'role') = 'host';
$$;

comment on function public.is_host() is
  'True for a signed-in, non-anonymous user whose app_metadata.role is ''host'' (set by an admin only).';
