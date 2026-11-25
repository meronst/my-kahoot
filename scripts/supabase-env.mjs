#!/usr/bin/env node
/**
 * scripts/supabase-env.mjs — prints the LOCAL Supabase stack's public settings as env lines:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
 *
 * Used by CI before E2E tests (`node scripts/supabase-env.mjs >> $GITHUB_ENV`) so the app under test
 * talks to the local stack started by `make db-start`. Locally: `node scripts/supabase-env.mjs > .env.local`.
 * Only PUBLIC values of a throwaway local stack are printed, never a secret key.
 */
import { execFileSync } from "node:child_process";

const out = execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8" });
const status = JSON.parse(out.slice(out.indexOf("{")));

/** First value whose key matches one of the patterns (key names changed across CLI versions). */
const pick = (patterns) => {
  for (const re of patterns) {
    const key = Object.keys(status).find((k) => re.test(k));
    if (key) return status[key];
  }
  return undefined;
};

const url = pick([/^API_URL$/i, /API.*URL/i]);
const key = pick([/^PUBLISHABLE_KEY$/i, /^ANON_KEY$/i, /PUBLISHABLE/i, /ANON/i]);
if (!url || !key) {
  console.error(`Couldn't find API URL / publishable key. Keys seen: ${Object.keys(status).join(", ")}`);
  process.exit(1);
}
console.log(`NEXT_PUBLIC_SUPABASE_URL=${url}`);
console.log(`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}`);
