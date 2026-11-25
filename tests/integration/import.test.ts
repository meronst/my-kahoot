/**
 * tests/integration/import.test.ts — import_rounds(): all-or-nothing, appended, host-only (KQ-18).
 */
import { describe, expect, it } from "vitest";
import { admin, DEMO_HOST, signedIn } from "./clients";

const good = (text: string) => ({
  type: "mc", text, time_limit_sec: 20, explanation: null,
  options: [{ text: "א", correct: true }, { text: "ב", correct: false }],
});

async function emptyQuiz() {
  const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
  const { data: quiz } = await host.from("quizzes").insert({ title: "ייבוא" }).select().single();
  return { host, quizId: quiz!.id };
}

describe("import_rounds", () => {
  it("adds the rounds after the existing ones, in order", async () => {
    const { host, quizId } = await emptyQuiz();
    await host.from("rounds").insert({ quiz_id: quizId, position: 0, title: "קיים" });

    const { data: count, error } = await host.rpc("import_rounds", {
      p_quiz_id: quizId,
      p_rounds: [{ title: "פתיחה", questions: [good("ש1"), good("ש2")] }, { title: null, questions: [good("ש3")] }],
    });
    expect(error).toBeNull();
    expect(count).toBe(3);

    const { data: rounds } = await host.from("rounds").select("title, position, questions(text, position)")
      .eq("quiz_id", quizId).order("position").order("position", { referencedTable: "questions" });
    expect(rounds!.map((r) => [r.title, r.questions.map((q) => q.text)])).toEqual([["קיים", []], ["פתיחה", ["ש1", "ש2"]], [null, ["ש3"]]]);
  });

  it("saves nothing when one question is invalid", async () => {
    const { host, quizId } = await emptyQuiz();
    const bad = { ...good("שבורה"), options: [{ text: "א", correct: true }, { text: "ב", correct: true }] };
    const { error } = await host.rpc("import_rounds", {
      p_quiz_id: quizId,
      p_rounds: [{ title: "1", questions: [good("ש1")] }, { title: "2", questions: [bad] }],
    });
    expect(error).not.toBeNull();
    expect((await admin().from("rounds").select("id").eq("quiz_id", quizId)).data).toEqual([]);
  });

  it("another host can't import into my quiz", async () => {
    const { quizId } = await emptyQuiz();
    const email = `host-import-${Date.now()}@my-kahoot.local`;
    await admin().auth.admin.createUser({ email, password: "host-import-pw", email_confirm: true, app_metadata: { role: "host" } });
    const other = await signedIn(email, "host-import-pw");
    const { error } = await other.rpc("import_rounds", { p_quiz_id: quizId, p_rounds: [{ title: null, questions: [good("ש")] }] });
    expect(error?.message).toBe("quiz_not_found");
  });
});
