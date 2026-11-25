/**
 * tests/unit/quiz-settings.test.ts — validation of the quiz settings form (KQ-15).
 */
import { describe, expect, it } from "vitest";
import { parseQuizSettings } from "@/lib/quiz-settings";
import { t } from "@/strings/he";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("parseQuizSettings", () => {
  it("accepts a valid form; an unchecked box means false", () => {
    expect(parseQuizSettings(form({ title: "  מגילות  ", scoring_mode: "points" }))).toEqual({
      ok: true, value: { title: "מגילות", scoring_mode: "points", collect_phone: false },
    });
    expect(parseQuizSettings(form({ title: "א", scoring_mode: "speed", collect_phone: "on" }))).toMatchObject({
      ok: true, value: { collect_phone: true },
    });
  });
  it("rejects an empty or too-long title", () => {
    expect(parseQuizSettings(form({ title: "  ", scoring_mode: "speed" }))).toEqual({ ok: false, error: t.quiz.titleRequired });
    expect(parseQuizSettings(form({ title: "א".repeat(121), scoring_mode: "speed" }))).toEqual({ ok: false, error: t.quiz.titleTooLong });
  });
  it("rejects a forged scoring mode", () => {
    expect(parseQuizSettings(form({ title: "א", scoring_mode: "double" })).ok).toBe(false);
  });
});
