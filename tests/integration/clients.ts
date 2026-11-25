/**
 * tests/integration/clients.ts — ready-made Supabase clients for each kind of user, for tests.
 *
 * Each helper returns a separate client logged in as a different person, so a test can ask
 * "what does THIS user see?". `persistSession: false` keeps every client's login in memory only,
 * so clients never share a session.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { localSupabase } from "./supabase-env";

export type Db = SupabaseClient<Database>;

const env = localSupabase();
const options = { auth: { persistSession: false, autoRefreshToken: false } };

/** The seeded demo host (supabase/seed.sql). */
export const DEMO_HOST = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "demo-host@my-kahoot.local",
  password: "demo-password-123",
};
export const DEMO_QUIZ_ID = "22222222-2222-2222-2222-222222222222";

/** Not logged in at all: what a random visitor's browser sends. */
export function visitor(): Db {
  return createClient<Database>(env.url, env.publicKey, options);
}

/** Admin client: bypasses RLS. Use ONLY to arrange test data, never to check access. */
export function admin(): Db {
  return createClient<Database>(env.url, env.secretKey, options);
}

/** A client signed in with email + password (a host). */
export async function signedIn(email: string, password: string): Promise<Db> {
  const client = visitor();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

/** A client signed in anonymously (a player), plus their user id. */
export async function anonymousPlayer(): Promise<{ client: Db; userId: string }> {
  const client = visitor();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error("anonymous sign-in returned no user");
  return { client, userId: data.user.id };
}

/** A random 6-digit PIN for test sessions. */
export function randomPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
