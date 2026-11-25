-- supabase/migrations/20261125125442_health_check.sql
--
-- Concept — migrations:
--   Each file in supabase/migrations is one versioned change to the database schema, applied once,
--   in filename (timestamp) order. Like Flyway or Liquibase in the Java world, or Alembic in Python.
--   Never edit a migration after it has been applied to the cloud project; add a new one instead.
--
-- This first migration adds a tiny `health()` function. It's used to:
--   - prove the whole chain works (migration → local DB → API → integration test) in KQ-4;
--   - later, by the keep-alive ping and the "system ready" light on /host (KQ-21).
--
-- Concept — RPC (remote procedure call):
--   Supabase exposes Postgres functions over HTTP. From TypeScript, `supabase.rpc("health")` calls
--   this function and returns its result. The game logic (KQ-9) will be written the same way.

create or replace function public.health()
returns text
language sql
stable                -- reads nothing and changes nothing; Postgres may cache the result within a query
security invoker      -- runs with the caller's permissions, not the function owner's
set search_path = ''  -- security hardening: don't resolve names through a search path an attacker could change
as $$
  select 'ok'::text;
$$;

comment on function public.health() is 'Liveness check: returns ''ok''. Used by integration tests, keep-alive and /host readiness.';

-- Who may call it: anyone, including not-logged-in visitors (role "anon"), because the
-- readiness check runs before login. It reveals nothing.
grant execute on function public.health() to anon, authenticated;
