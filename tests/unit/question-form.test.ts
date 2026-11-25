/**
 * tests/unit/question-form.test.ts — validation of the question editor form (KQ-16).
 */
import { describe, expect, it } from "vitest";
import { parseQuestionForm } from "@/lib/question-form";
import { t } from "@/strings/he";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const mc = (extra: Record<string, string> = {}) =>
  form({ type: "mc", text: " מהי בירת ישראל? ", option_0: "תל אביב", option_1: "ירושלים", correct: "1", time_limit: "20", ...extra });

describe("parseQuestionForm", () => {
  it("accepts a multiple-choice question", () => {
    expect(parseQuestionForm(mc({ explanation: " כי כך " }))).toEqual({
      ok: true,
      value: {
        type: "mc",
        text: "מהי בירת ישראל?",
        options: [{ text: "תל אביב", correct: false }, { text: "ירושלים", correct: true }],
        time_limit_sec: 20,
        explanation: "כי כך",
      },
    });
  });

  it("skips empty inputs but keeps the correct answer pointing at the right option", () => {
    // Inputs 0 and 2 filled, input 2 marked correct → 2 options, the second one correct.
    const r = parseQuestionForm(form({ type: "mc", text: "ש", option_0: "א", option_2: "ג", correct: "2", time_limit: "" }));
    expect(r).toEqual({
      ok: true,
      value: { type: "mc", text: "ש", options: [{ text: "א", correct: false }, { text: "ג", correct: true }], time_limit_sec: null, explanation: null },
    });
  });

  it("true/false always uses the fixed pair, whatever the option inputs say", () => {
    const r = parseQuestionForm(form({ type: "tf", text: "ש", option_0: "זה", correct: "1", time_limit: "15" }));
    expect(r).toMatchObject({ ok: true, value: { options: [{ text: "נכון", correct: false }, { text: "לא נכון", correct: true }] } });
  });

  it("returns a Hebrew message for each mistake", () => {
    const err = (f: FormData) => {
      const r = parseQuestionForm(f);
      return r.ok ? null : r.error;
    };
    expect(err(mc({ text: "  " }))).toBe(t.editor.errors.textRequired);
    expect(err(mc({ text: "א".repeat(301) }))).toBe(t.editor.errors.textTooLong);
    expect(err(mc({ option_1: "" }))).toBe(t.editor.errors.twoOptions);
    expect(err(mc({ option_1: "א".repeat(101) }))).toBe(t.editor.errors.optionTooLong);
    expect(err(mc({ option_1: "תל אביב" }))).toBe(t.editor.errors.duplicateOptions);
    expect(err(mc({ correct: "3" }))).toBe(t.editor.errors.pickCorrect); // marked an empty input
    expect(err(form({ type: "mc", text: "ש", option_0: "א", option_1: "ב", time_limit: "" }))).toBe(t.editor.errors.pickCorrect);
    expect(err(mc({ explanation: "א".repeat(501) }))).toBe(t.editor.errors.explanationTooLong);
  });

  it("rejects forged values the form can't produce", () => {
    expect(parseQuestionForm(mc({ type: "essay" })).ok).toBe(false);
    expect(parseQuestionForm(mc({ time_limit: "7" })).ok).toBe(false);
  });
});
