/**
 * tests/integration/health.test.ts — the first integration test: proves the whole database chain works.
 *
 * migration file → applied to the local Postgres by `supabase start` → exposed over HTTP by Supabase
 * → called from TypeScript with the official client → returns "ok".
 *
 * Concept — the Supabase client:
 *   `createClient(url, key)` gives an object for talking to the database over HTTP (no direct SQL
 *   connection). The "publishable" (public) key is safe in a browser: what it may do is limited by the
 *   database's permissions (GRANTs now, Row Level Security from KQ-5).
 */
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import { localSupabase } from "./supabase-env";

const { url, publicKey } = localSupabase();
// `<Database>` plugs in the generated types, so `rpc("health")` and its result are type-checked.
const supabase = createClient<Database>(url, publicKey);

describe("database health", () => {
  it("health() returns 'ok' for an anonymous caller", async () => {
    const { data, error } = await supabase.rpc("health");
    expect(error).toBeNull();
    expect(data).toBe("ok");
  });
});
