/**
 * lib/question-form.ts — reads and validates the question editor form. Pure, unit-tested.
 *
 * Mirrors the database rules (valid_options CHECK: 2–4 options, true/false exactly 2, exactly one
 * correct, no empty text; time limit 5–300s or none) so the host gets a clear Hebrew message instead
 * of a database error. The database checks again anyway.
 *
 * Form fields: type (mc|tf), text, option_0..option_3, correct (index), time_limit ("" = none), explanation.
 */
import { t } from "@/strings/he";

export const TIMER_CHOICES = [10, 15, 20, 30, 45, 60, 90, 120] as const;
export const TF_OPTIONS = ["נכון", "לא נכון"] as const;
export const MAX_QUESTION = 300;
export const MAX_OPTION = 100;
export const MAX_EXPLANATION = 500;

export type QuestionInput = {
  type: "mc" | "tf";
  text: string;
  options: { text: string; correct: boolean }[];
  time_limit_sec: number | null;
  explanation: string | null;
};

export function parseQuestionForm(
  form: FormData,
): { ok: true; value: QuestionInput } | { ok: false; error: string } {
  const type = String(form.get("type") ?? "");
  if (type !== "mc" && type !== "tf") return { ok: false, error: t.editor.errors.generic };

  const text = String(form.get("text") ?? "").trim();
  if (!text) return { ok: false, error: t.editor.errors.textRequired };
  if (text.length > MAX_QUESTION) return { ok: false, error: t.editor.errors.textTooLong };

  // True/false always uses the fixed pair. Multiple choice keeps the filled-in inputs, in order,
  // remembering which input each came from (the "correct" radio refers to an input number).
  const entries =
    type === "tf"
      ? TF_OPTIONS.map((text, input) => ({ input, text: text as string }))
      : [0, 1, 2, 3]
          .map((input) => ({ input, text: String(form.get(`option_${input}`) ?? "").trim() }))
          .filter((e) => e.text !== "");
  if (type === "mc" && entries.length < 2) return { ok: false, error: t.editor.errors.twoOptions };
  if (entries.some((e) => e.text.length > MAX_OPTION)) return { ok: false, error: t.editor.errors.optionTooLong };
  if (new Set(entries.map((e) => e.text)).size !== entries.length) {
    return { ok: false, error: t.editor.errors.duplicateOptions };
  }

  const correctInput = Number(form.get("correct") ?? NaN);
  const correctIndex = entries.findIndex((e) => e.input === correctInput);
  if (correctIndex === -1) return { ok: false, error: t.editor.errors.pickCorrect };

  const timeRaw = String(form.get("time_limit") ?? "");
  const time_limit_sec = timeRaw === "" ? null : Number(timeRaw);
  if (time_limit_sec !== null && !(TIMER_CHOICES as readonly number[]).includes(time_limit_sec)) {
    return { ok: false, error: t.editor.errors.generic };
  }

  const explanation = String(form.get("explanation") ?? "").trim();
  if (explanation.length > MAX_EXPLANATION) return { ok: false, error: t.editor.errors.explanationTooLong };

  const options = entries.map((e, i) => ({ text: e.text, correct: i === correctIndex }));

  return { ok: true, value: { type, text, options, time_limit_sec, explanation: explanation || null } };
}
