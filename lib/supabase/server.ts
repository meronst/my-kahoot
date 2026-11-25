/**
 * lib/supabase/server.ts — a Supabase client for SERVER code (Server Components and Server Actions).
 *
 * Concept — why login lives in cookies:
 *   After login, Supabase gives the browser a token proving who it is. To let the SERVER also know
 *   who's asking (when it renders /host), the token is stored in cookies, which the browser sends with
 *   every request. @supabase/ssr reads and writes those cookies for us.
 *
 * Create a NEW client per request (never a shared global): each request carries a different user's
 * cookies. Think "request-scoped bean" in Spring, not a singleton.
 *
 * `import "server-only"` makes the build fail if this file is ever imported into browser code.
 */
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "./env";

export async function createSupabaseServerClient() {
  // `cookies()` gives this request's cookies. In Next.js 16 it's async, hence `await`.
  // It must come FIRST: during `next build`, reading cookies tells Next.js "this part depends on the
  // request, don't prerender it". Anything before it would run at build time, where there's no
  // request and no Supabase settings.
  const cookieStore = await cookies();
  // `connection()` = "wait for a live request". Cookies alone aren't enough: with partial prefetching,
  // Next.js may render ahead of time WITH cookies but without a request, and the Supabase client reads
  // the clock (Date.now) to check token expiry, which Next.js forbids during prerendering (bug KQ-27).
  await connection();
  const { url, publishableKey } = supabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components may not set cookies (only Server Actions and the proxy can).
          // Safe to ignore: proxy.ts refreshes the login cookies on every /host request.
        }
      },
    },
  });
}
