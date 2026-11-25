/**
 * tests/integration/supabase-env.ts — finds the URL and public key of the LOCAL Supabase stack for tests.
 *
 * Integration tests talk to a real database, started with `npx supabase start` (Docker).
 * Instead of copying keys into a file, we ask the CLI: `supabase status -o json` prints the running
 * stack's settings. The exact key names have changed between CLI versions (ANON_KEY → PUBLISHABLE_KEY),
 * so we search for them by pattern rather than hard-coding one name.
 *
 * Environment variables SUPABASE_TEST_URL / SUPABASE_TEST_KEY, if set, win — handy for debugging.
 */
import { execFileSync } from "node:child_process";

export type LocalSupabase = { url: string; publicKey: string };

/** Picks the first value whose key matches one of the patterns, in order of preference. */
function pick(status: Record<string, unknown>, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const key = Object.keys(status).find((k) => re.test(k));
    if (key && typeof status[key] === "string") return status[key] as string;
  }
  return undefined;
}

export function localSupabase(): LocalSupabase {
  if (process.env.SUPABASE_TEST_URL && process.env.SUPABASE_TEST_KEY) {
    return { url: process.env.SUPABASE_TEST_URL, publicKey: process.env.SUPABASE_TEST_KEY };
  }

  let status: Record<string, unknown>;
  try {
    const out = execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8" });
    status = JSON.parse(out.slice(out.indexOf("{"))); // skip any banner text before the JSON
  } catch (err) {
    throw new Error(
      "Local Supabase isn't running. Start it with `npx supabase start` (needs Docker).\n" + String(err),
    );
  }

  const url = pick(status, [/^API_URL$/i, /API.*URL/i]);
  const publicKey = pick(status, [/^PUBLISHABLE_KEY$/i, /^ANON_KEY$/i, /PUBLISHABLE/i, /ANON/i]);
  if (!url || !publicKey) {
    // Print only key NAMES, never values: secrets must not end up in CI logs.
    throw new Error(`Couldn't find URL/public key in supabase status. Keys seen: ${Object.keys(status).join(", ")}`);
  }
  return { url, publicKey };
}
