/**
 * lib/supabase/env.ts — reads the Supabase connection settings from environment variables.
 *
 * Concept — NEXT_PUBLIC_ variables:
 *   Next.js copies variables whose name starts with NEXT_PUBLIC_ into the JavaScript sent to the
 *   browser (at build time). That's fine here: the URL and the publishable key are public by design;
 *   what they allow is limited by the database's Row Level Security. Anything secret must NOT start
 *   with NEXT_PUBLIC_.
 *
 * Read lazily (inside a function) so `next build` works without them; the error appears only when
 * code actually needs Supabase, with a message saying exactly what to set.
 */
export function supabaseEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Copy .env.example to .env.local (locally) or set them in Vercel → Settings → Environment Variables.",
    );
  }
  return { url, publishableKey };
}
