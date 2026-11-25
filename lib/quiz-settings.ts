/**
 * lib/quiz-settings.ts — reads and validates the quiz settings form. A pure function, unit-tested.
 *
 * Server Actions receive raw form fields (strings) that anyone could forge, so they're checked here
 * before reaching the database (which checks again: non-empty title, valid enum).
 */
import type { ScoringMode } from "@/lib/scoring";
import { t } from "@/strings/he";

export const SCORING_MODES: ScoringMode[] = ["speed", "points", "results"];
export const MAX_TITLE = 120;

export type QuizSettings = { title: string; scoring_mode: ScoringMode; collect_phone: boolean };

export function parseQuizSettings(
  form: FormData,
): { ok: true; value: QuizSettings } | { ok: false; error: string } {
  const title = String(form.get("title") ?? "").trim();
  const mode = String(form.get("scoring_mode") ?? "");
  if (!title) return { ok: false, error: t.quiz.titleRequired };
  if (title.length > MAX_TITLE) return { ok: false, error: t.quiz.titleTooLong };
  if (!SCORING_MODES.includes(mode as ScoringMode)) return { ok: false, error: t.quiz.saveFailed };
  return {
    ok: true,
    // An unchecked checkbox sends nothing at all, so "present" means on.
    value: { title, scoring_mode: mode as ScoringMode, collect_phone: form.get("collect_phone") === "on" },
  };
}
