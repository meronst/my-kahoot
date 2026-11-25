/**
 * app/host/actions.ts — Server Actions for the host area.
 */
"use server";

import { redirect } from "next/navigation";
import { getHost } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Starts a live session for a quiz and opens its lobby (KQ-7).
 *
 * Concept — binding a value into a Server Action: the quiz list calls
 * `startSession.bind(null, quiz.id)`, which pre-fills the first argument. The browser never sends a
 * quiz id it could tamper with... it could, in principle, and that's fine: the database function
 * create_session() checks that the caller is the host AND owns the quiz.
 */
export async function startSession(quizId: string): Promise<void> {
  await getHost(); // not the host → redirected to the login page
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_session", { p_quiz_id: quizId });
  if (error || !data) throw new Error(`create_session failed: ${error?.message ?? "no data"}`);
  redirect(`/host/sessions/${data.id}`);
}
