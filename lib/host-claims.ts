/**
 * lib/host-claims.ts — the "is this login the host?" rule, as a pure function.
 *
 * Kept separate from lib/auth.ts (which is server-only) so that the proxy and unit tests can use it.
 * Must match the database's is_host() (supabase/migrations/*_host_role.sql): signed in, not
 * anonymous, and app_metadata.role === "host". The database enforces the rule regardless; the app
 * checks it too so it can redirect cleanly instead of showing empty pages.
 *
 * `claims` are the fields inside the verified login token (JWT): sub = user id, email,
 * is_anonymous, app_metadata (admin-controlled), ...
 */
export function isHostClaims(claims: Record<string, unknown> | null | undefined): boolean {
  if (!claims || typeof claims.sub !== "string") return false;
  if (claims.is_anonymous === true) return false;
  const appMetadata = claims.app_metadata as { role?: unknown } | undefined;
  return appMetadata?.role === "host";
}
