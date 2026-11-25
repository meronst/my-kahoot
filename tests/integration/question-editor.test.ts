/**
 * tests/integration/question-editor.test.ts — rounds and questions through the host's own
 * permissions, and the move_round / move_question functions (KQ-16).
 */
import { describe, expect, it } from "vitest";
import { admin, DEMO_HOST, DEMO_QUIZ_ID, signedIn } from "./clients";

/** A private copy of the demo quiz, so tests don't disturb each other or the seed. */
async function freshQuiz() {
  const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
  const { data: quiz, error } = await host.rpc("duplicate_quiz", { p_quiz_id: DEMO_QUIZ_ID });
  expect(error).toBeNull();
  return { host, quizId: quiz!.id };
}

describe("question editor (host)", () => {
  it("adds, edits and deletes rounds and questions", async () => {
    const { host, quizId } = await freshQuiz();
    const { data: round, error } = await host.from("rounds").insert({ quiz_id: quizId, position: 2, title: "סבב שלישי" }).select().single();
    expect(error).toBeNull();

    const { data: q, error: qErr } = await host.from("questions").insert({
      round_id: round!.id, position: 0, type: "tf", text: "השמש היא כוכב",
      options: [{ text: "נכון", correct: true }, { text: "לא נכון", correct: false }],
    }).select().single();
    expect(qErr).toBeNull();

    const { error: upErr } = await host.from("questions").update({ text: "הירח הוא כוכב", options: [{ text: "נכון", correct: false }, { text: "לא נכון", correct: true }] }).eq("id", q!.id);
    expect(upErr).toBeNull();

    // The database still refuses an invalid question (two correct answers).
    const bad = await host.from("questions").update({ options: [{ text: "נכון", correct: true }, { text: "לא נכון", correct: true }] }).eq("id", q!.id);
    expect(bad.error).not.toBeNull();

    expect((await host.from("rounds").delete().eq("id", round!.id)).error).toBeNull();
    expect((await admin().from("questions").select("id").eq("id", q!.id)).data).toEqual([]); // cascaded
  });

  it("move_round swaps with the neighbour and stops at the ends, across position gaps", async () => {
    const { host, quizId } = await freshQuiz();
    const db = admin();
    // Make a gap: positions 0 and 5.
    const { data: before } = await db.from("rounds").select("id, position").eq("quiz_id", quizId).order("position");
    await db.from("rounds").update({ position: 5 }).eq("id", before![1].id);
    const [first, second] = before!.map((r) => r.id);

    const order = async () => (await db.from("rounds").select("id").eq("quiz_id", quizId).order("position")).data!.map((r) => r.id);

    expect((await host.rpc("move_round", { p_round_id: second, p_direction: -1 })).error).toBeNull();
    expect(await order()).toEqual([second, first]);
    expect((await host.rpc("move_round", { p_round_id: second, p_direction: -1 })).error).toBeNull(); // already first
    expect(await order()).toEqual([second, first]);
    await host.rpc("move_round", { p_round_id: second, p_direction: 1 });
    expect(await order()).toEqual([first, second]);
    expect((await host.rpc("move_round", { p_round_id: second, p_direction: 2 })).error?.message).toBe("invalid_direction");
  });

  it("move_question swaps questions within their round", async () => {
    const { host, quizId } = await freshQuiz();
    const { data: round } = await host.from("rounds").select("id, questions(id, position)").eq("quiz_id", quizId).eq("position", 0).single();
    const ids = round!.questions.sort((a, b) => a.position - b.position).map((q) => q.id);
    expect((await host.rpc("move_question", { p_question_id: ids[0], p_direction: 1 })).error).toBeNull();
    const { data: after } = await host.from("questions").select("id").eq("round_id", round!.id).order("position");
    expect(after!.map((q) => q.id)).toEqual([ids[1], ids[0]]);
  });

  it("another host can't see, move or change my rounds and questions", async () => {
    const { quizId } = await freshQuiz();
    const db = admin();
    const { data: rounds } = await db.from("rounds").select("id, position").eq("quiz_id", quizId).order("position");
    const email = `host-editor-${Date.now()}@my-kahoot.local`;
    await db.auth.admin.createUser({ email, password: "host-editor-pw", email_confirm: true, app_metadata: { role: "host" } });
    const other = await signedIn(email, "host-editor-pw");

    expect((await other.rpc("move_round", { p_round_id: rounds![1].id, p_direction: -1 })).error?.message).toBe("round_not_found");
    await other.from("rounds").update({ title: "נפרץ" }).eq("id", rounds![0].id);
    const ins = await other.from("rounds").insert({ quiz_id: quizId, position: 9 });
    expect(ins.error).not.toBeNull();

    const { data: still } = await db.from("rounds").select("id, title").eq("quiz_id", quizId).order("position");
    expect(still!.map((r) => r.id)).toEqual(rounds!.map((r) => r.id));
    expect(still![0].title).not.toBe("נפרץ");
  });
});
