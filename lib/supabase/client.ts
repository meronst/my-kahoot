/**
 * lib/supabase/client.ts — a Supabase client for code running in the BROWSER (Client Components).
 *
 * Why a separate client from lib/supabase/server.ts: the browser keeps a live connection open for
 * Realtime (WebSocket) and reads the login cookie straight from the page, while the server builds a
 * fresh client per request. @supabase/ssr makes both share the same login cookies, so after the host
 * logs in, both sides know who they are.
 *
 * One client per browser tab is enough, so we keep a single instance (a lazy singleton). That's the
 * opposite of the server rule, where every request needs its own client.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "./env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const { url, publishableKey } = supabaseEnv();
    browserClient = createBrowserClient<Database>(url, publishableKey);
  }
  return browserClient;
}
