-- supabase/migrations/20261125195112_api_grants.sql — explicit API access to our tables (bug KQ-29).
--
-- Concept — GRANTs vs. RLS: two separate locks on the same door.
--   GRANT decides whether a role may touch a TABLE at all (e.g. "authenticated may SELECT quizzes").
--   RLS decides which ROWS it sees once inside (e.g. "only quizzes you own").
--   Both must say yes. Our RLS policies were right, but the grants were missing.
--
-- Why they were missing: since 2026, Supabase no longer grants API access to new tables
-- automatically (changelog #45329). Our cloud project follows the new rule; the local stack used to
-- auto-grant, so tests passed while production failed with "permission denied for table quizzes".
-- supabase/config.jsonc now sets auto_expose_new_tables=false, so local == cloud.
--
-- RULE FOR EVERY FUTURE MIGRATION: grant exactly what a new table or function needs, in the same file.
--
-- Roles:
--   anon           not logged in: no access to game tables (unchanged; the player join flow signs
--                  in anonymously first, which makes them `authenticated`)
--   authenticated  host AND players (anonymous sign-in); RLS separates them
--   service_role   admin key: server-side jobs and test setup; bypasses RLS

-- Host-managed content: the host creates, edits and deletes (RLS: owner + host role only).
grant select, insert, update, delete on public.quizzes, public.rounds, public.questions to authenticated;

-- Sessions: the host creates and drives them; players read their own (RLS).
grant select, insert, update, delete on public.sessions to authenticated;

-- Players and answers: read-only through the API. Joining and answering go through database
-- functions (KQ-8 join, KQ-9 submit_answer), which will be granted EXECUTE individually.
grant select on public.players, public.answers to authenticated;

-- Admin key: full access (it bypasses RLS by design; never used in the browser).
grant all on public.quizzes, public.rounds, public.questions,
              public.sessions, public.players, public.answers to service_role;

-- Functions used inside RLS policies and CHECK constraints run as the calling role, so the caller
-- needs EXECUTE on them too.
grant execute on function public.is_host() to authenticated, service_role;
grant execute on function public.valid_options(public.question_type, jsonb) to authenticated, service_role;
grant execute on function public.owns_session(uuid), public.is_player_in(uuid) to service_role;
grant execute on function public.create_session(uuid), public.health() to service_role;

-- Custom enum types used in the tables' columns.
grant usage on type public.scoring_mode, public.question_type, public.session_status
  to authenticated, service_role;
