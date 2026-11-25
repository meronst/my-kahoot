# ADR 0003 — The host is an admin-assigned role, not "any email account"

Status: accepted, 2026-11-25

## Context
ADR/architecture v1 defined the host as "signed in and not anonymous". The plan was to turn off sign-ups in Supabase so that only Meron's account could exist. But players join with **anonymous sign-in**, and Supabase treats every anonymous player as a new sign-up: with sign-ups disabled, players can't join. So sign-ups must stay enabled, and anyone could register an email account and pass a "not anonymous" check.

## Decision
The host is a user whose **`app_metadata.role` is `"host"`**.
- Database: `public.is_host()` checks `auth.jwt() -> 'app_metadata' ->> 'role' = 'host'` (migration `*_host_role.sql`). Every RLS policy on quizzes, rounds, questions and sessions goes through it.
- App: `lib/host-claims.ts` applies the same rule in the proxy, the login action and `getHost()`.
- `app_metadata` can only be changed with the admin key or SQL; users can't edit it themselves (unlike `user_metadata`).
- Setting the role (once per host account), in the Supabase SQL editor:
  ```sql
  update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"host"}'
  where email = '<host email>';
  ```

## Consequences
- A stranger who registers an email account can sign in to Supabase but can't create or read anything, and the login page tells them the account isn't a host. Covered by integration and unit tests.
- Adding another host later (v2, multiple hosts) is one SQL statement; the data model already scopes quizzes by `owner_id`.
- Email sign-ups still create (useless) accounts; if abuse appears, add CAPTCHA (Supabase supports Turnstile/hCaptcha) rather than disabling sign-ups.
