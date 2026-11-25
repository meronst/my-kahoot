/**
 * lib/auth.ts — "who is the host?" for server code. One place for the rule, used by every host page.
 *
 * This is the Data Access Layer pattern from the Next.js docs: pages never read cookies or tokens
 * themselves; they call getHost(), which either returns the host or redirects to the login page.
 *
 * The host rule itself lives in lib/host-claims.ts (shared with proxy.ts and the unit tests).
 */
import "server-only";
import { redirect } from "next/navigation";
import { isHostClaims } from "@/lib/host-claims";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Host = { id: string; email: string };

/**
 * Returns the signed-in host, or redirects to /host/login.
 *
 * `getClaims()` verifies the login token's signature before trusting it (never trust a cookie
 * without verifying it: anyone can edit their own cookies).
 */
export async function getHost(): Promise<Host> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  if (!isHostClaims(claims)) redirect("/host/login");
  return { id: claims!.sub as string, email: String(claims!.email ?? "") };
}
