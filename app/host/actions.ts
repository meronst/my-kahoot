/**
 * app/host/actions.ts — Server Actions for the host area: start a session, manage quizzes.
 *
 * Every action first calls getHost() (redirects to login if needed). The database still enforces
 * ownership through RLS, so a forged request can't touch another host's quiz.
 *
 * Concept — refresh(): after changing data, tell the browser to re-render the current page from the
 * server, so lists show the change. (Our pages are request-time, so there's no cache to invalidate.)
 */
"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getHost } from "@/lib/auth";
import { parseQuizSettings } from "@/lib/quiz-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { t } from "@/strings/he";

/**
 * Starts a live session for a quiz and opens its lobby (KQ-7).
 *
 * Concept — binding a value into a Server Action: the quiz list calls
 * `startSession.bind(null, quiz.id)`, which pre-fills the first argument.
 */
export async function startSession(quizId: string): Promise<void> {
  await getHost();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_session", { p_quiz_id: quizId });
  if (error || !data) throw new Error(`create_session failed: ${error?.message ?? "no data"}`);
  redirect(`/host/sessions/${data.id}`);
}

/** Creates an empty quiz with default settings and opens its editor. */
export async function createQuiz(): Promise<void> {
  await getHost();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("quizzes").insert({ title: t.quiz.defaultTitle }).select("id").single();
  if (error || !data) throw new Error(`create quiz failed: ${error?.message ?? "no data"}`);
  redirect(`/host/quizzes/${data.id}`);
}

/** Copies a quiz with all its rounds and questions (database function duplicate_quiz). */
export async function duplicateQuiz(quizId: string): Promise<void> {
  await getHost();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("duplicate_quiz", { p_quiz_id: quizId });
  if (error) throw new Error(`duplicate failed: ${error.message}`);
  refresh();
}

/** Deletes a quiz; rounds, questions and past sessions go with it (ON DELETE CASCADE). */
export async function deleteQuiz(quizId: string): Promise<void> {
  await getHost();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
  if (error) throw new Error(`delete failed: ${error.message}`);
  refresh();
}

export type SettingsState = { saved?: boolean; error?: string };

/** Saves title, scoring mode and the collect-phone switch (used with useActionState). */
export async function saveQuizSettings(quizId: string, _prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await getHost();
  const parsed = parseQuizSettings(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("quizzes").update(parsed.value).eq("id", quizId);
  if (error) return { error: t.quiz.saveFailed };
  refresh();
  return { saved: true };
}
