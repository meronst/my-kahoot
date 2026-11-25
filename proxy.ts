/**
 * proxy.ts — runs BEFORE every /host request (Next.js 16 renamed "middleware" to "proxy").
 *
 * Two jobs:
 *  1. Keep the login fresh. Login tokens expire after about an hour; the client library refreshes
 *     them using a long-lived refresh token. Server Components can't write cookies, so the refresh
 *     has to happen here, where we can set cookies on the response.
 *  2. Fast gate: a visitor who isn't the host is redirected to /host/login before any page renders.
 *     Pages still call getHost() themselves (defense in depth); this just avoids rendering for nothing.
 *
 * Concept — the request/response pair: `request` is what the browser sent; we return a response
 * that either lets the request continue (NextResponse.next) or redirects. Like a servlet Filter.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isHostClaims } from "@/lib/host-claims";
import { supabaseEnv } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = supabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      // When the library refreshes the token, write the new cookies to BOTH the request (so pages
      // rendered for this request see them) and the response (so the browser stores them).
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Cache headers from the library: a response that sets login cookies must never be cached.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Verifies the token and refreshes it if needed (which triggers setAll above).
  const { data } = await supabase.auth.getClaims();
  const isHost = isHostClaims(data?.claims as Record<string, unknown> | undefined);

  const isLoginPage = request.nextUrl.pathname === "/host/login";
  if (!isHost && !isLoginPage) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/host/login";
    const redirect = NextResponse.redirect(loginUrl);
    // Keep any refreshed cookies on the redirect too.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

// Only host pages pass through the proxy; player pages and static files don't pay for it.
export const config = {
  matcher: ["/host/:path*"],
};
