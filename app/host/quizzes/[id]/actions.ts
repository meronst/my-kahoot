/**
 * app/host/quizzes/[id]/actions.ts — Server Actions for the rounds and questions editor (KQ-16).
 *
 * Each one: confirm the host (getHost), change the database with the host's own permissions (RLS
 * limits everything to their quizzes), then refresh() so the page shows the change.
 * New items go to the end: position = (largest position so far) + 1. Gaps after deletions are fine;
 * only the order of positions matters.
 */
"use server";

import { refresh } from "next/cache";
import { getHost } from "@/lib/auth";
import { IMAGE_BUCKET } from "@/lib/question-image";
import { parseQuestionForm, TF_OPTIONS } from "@/lib/question-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { t } from "@/strings/he";

async function db() {
  await getHost();
  return createSupabaseServerClient();
}

/** Throws with the database message: shown by the nearest error boundary, never silently ignored. */
function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what} failed: ${error.message}`);
}

export async function addRound(quizId: string): Promise<void> {
  const supabase = await db();
  const { data: last } = await supabase
    .from("rounds").select("position").eq("quiz_id", quizId).order("position", { ascending: false }).limit(1);
  const { error } = await supabase.from("rounds").insert({ quiz_id: quizId, position: (last?.[0]?.position ?? -1) + 1 });
  check(error, "add round");
  refresh();
}

export async function renameRound(roundId: string, formData: FormData): Promise<void> {
  const supabase = await db();
  const title = String(formData.get("title") ?? "").trim().slice(0, 80);
  const { error } = await supabase.from("rounds").update({ title: title || null }).eq("id", roundId);
  check(error, "rename round");
  refresh();
}

export async function deleteRound(roundId: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("rounds").delete().eq("id", roundId); // questions cascade
  check(error, "delete round");
  refresh();
}

export async function moveRound(roundId: string, direction: -1 | 1): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.rpc("move_round", { p_round_id: roundId, p_direction: direction });
  check(error, "move round");
  refresh();
}

/**
 * Adds a question with placeholder content that already satisfies the database rules, then the host
 * edits it in place. (A question row must always be valid: options CHECK constraint.)
 */
export async function addQuestion(roundId: string, type: "mc" | "tf"): Promise<void> {
  const supabase = await db();
  const { data: last } = await supabase
    .from("questions").select("position").eq("round_id", roundId).order("position", { ascending: false }).limit(1);
  const options =
    type === "tf"
      ? TF_OPTIONS.map((text, i) => ({ text, correct: i === 0 }))
      : [
          { text: `${t.editor.optionPlaceholder} 1`, correct: true },
          { text: `${t.editor.optionPlaceholder} 2`, correct: false },
        ];
  const { error } = await supabase.from("questions").insert({
    round_id: roundId,
    position: (last?.[0]?.position ?? -1) + 1,
    type,
    text: t.editor.newQuestionText,
    time_limit_sec: 20,
    options,
  });
  check(error, "add question");
  refresh();
}

export type QuestionSaveState = { saved?: boolean; error?: string };

export async function saveQuestion(
  questionId: string,
  _prev: QuestionSaveState,
  formData: FormData,
): Promise<QuestionSaveState> {
  const parsed = parseQuestionForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const supabase = await db();
  // .select() returns the updated rows: RLS turns "not your question" into zero rows, not an error,
  // so an empty result must count as a failure too.
  const { data, error } = await supabase.from("questions").update(parsed.value).eq("id", questionId).select("id");
  if (error || !data?.length) return { error: t.editor.errors.generic };
  refresh();
  return { saved: true };
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("questions").delete().eq("id", questionId);
  check(error, "delete question");
  refresh();
}

export async function moveQuestion(questionId: string, direction: -1 | 1): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.rpc("move_question", { p_question_id: questionId, p_direction: direction });
  check(error, "move question");
  refresh();
}

const IMAGE_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/;

/**
 * Attaches an uploaded image to a question, or removes it (path = null) (KQ-17).
 * The browser has already uploaded the file to Storage; here we only record its path.
 * The old file is deleted unless another question still uses it (a duplicated quiz shares images).
 */
export async function setQuestionImage(questionId: string, path: string | null): Promise<{ error?: string }> {
  if (path !== null && !IMAGE_PATH.test(path)) return { error: t.editor.image.failed };
  const supabase = await db();
  const { data: before } = await supabase.from("questions").select("image_path").eq("id", questionId).maybeSingle();
  if (!before) return { error: t.editor.image.failed };

  const { data, error } = await supabase.from("questions").update({ image_path: path }).eq("id", questionId).select("id");
  if (error || !data?.length) return { error: t.editor.image.failed };

  const old = before.image_path;
  if (old && old !== path) {
    const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("image_path", old);
    if (!count) await supabase.storage.from(IMAGE_BUCKET).remove([old]); // best effort: a leftover file is harmless
  }
  refresh();
  return {};
}
