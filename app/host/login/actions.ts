/**
 * app/host/login/actions.ts — the code that runs on the SERVER when the login form is submitted.
 *
 * Concept — Server Actions ("use server"):
 *   A function marked "use server" can be passed to a <form action={...}>. When the user submits,
 *   the browser POSTs the form to Next.js, which runs this function on the server and sends back the
 *   result. No API route to write by hand: it's like a Spring @PostMapping generated for you.
 *   The password goes browser → our server → Supabase over HTTPS; it never touches page JavaScript.
 *
 * With useActionState (see login-form.tsx) the function receives the previous state first and
 * returns the new state, here: an error message to show, or nothing because we redirected.
 */
"use server";

import { redirect } from "next/navigation";
import { isHostClaims } from "@/lib/host-claims";
import { loginErrorMessage } from "@/lib/auth-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { t } from "@/strings/he";

export type LoginState = { error?: string; email?: string };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: t.login.errors.missingFields, email };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Return the email (never the password) so the form can keep it filled in after an error.
  if (error) return { error: loginErrorMessage(error), email };

  // Correct password, but is this account the host? (Sign-ups are open for players; see ADR 0003.)
  const { data } = await supabase.auth.getClaims();
  if (!isHostClaims(data?.claims as Record<string, unknown> | undefined)) {
    await supabase.auth.signOut();
    return { error: t.login.errors.notHost, email };
  }

  // redirect() works by throwing a special signal, so it must be outside any try/catch.
  redirect("/host");
}

/** Sign out and go back to the login page. Used by the button on /host. */
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/host/login");
}
