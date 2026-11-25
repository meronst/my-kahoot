/**
 * tests/integration/quiz-management.test.ts — creating, editing, duplicating and deleting quizzes
 * through the host's own permissions (KQ-15).
 */
import { describe, expect, it } from "vitest";
import { admin, anonymousPlayer, DEMO_HOST, DEMO_QUIZ_ID, signedIn } from "./clients";

describe("quiz management (host)", () => {
  it("creates a quiz and saves its settings", async () => {
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const { data: quiz, error } = await host.from("quizzes").insert({ title: "חידון חדש" }).select().single();
    expect(error).toBeNull();
    expect(quiz).toMatchObject({ owner_id: DEMO_HOST.id, scoring_mode: "speed", collect_phone: false });

    const { error: updateError } = await host.from("quizzes")
      .update({ title: "מגילות ים המלח", scoring_mode: "points", collect_phone: true }).eq("id", quiz!.id);
    expect(updateError).toBeNull();
    const { data: saved } = await host.from("quizzes").select("title, scoring_mode, collect_phone").eq("id", quiz!.id).single();
    expect(saved).toEqual({ title: "מגילות ים המלח", scoring_mode: "points", collect_phone: true });
  });

  it("rejects an empty title", async () => {
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const { error } = await host.from("quizzes").insert({ title: "   " });
    expect(error).not.toBeNull();
  });

  it("duplicates a quiz with all rounds and questions, as new rows", async () => {
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const { data: copy, error } = await host.rpc("duplicate_quiz", { p_quiz_id: DEMO_QUIZ_ID });
    expect(error).toBeNull();
    expect(copy!.title).toBe("עותק של חידון לדוגמה");
    expect(copy!.id).not.toBe(DEMO_QUIZ_ID);
    expect(copy!.owner_id).toBe(DEMO_HOST.id);

    const { data: rounds } = await host.from("rounds").select("id, position, questions(text, position, options)")
      .eq("quiz_id", copy!.id).order("position");
    expect(rounds!.map((r) => r.questions.length)).toEqual([2, 1]);
    const { data: original } = await host.from("rounds").select("id").eq("quiz_id", DEMO_QUIZ_ID);
    expect(rounds!.map((r) => r.id)).not.toContain(original![0].id);
  });

  it("deleting a quiz removes its rounds, questions and sessions", async () => {
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const { data: copy } = await host.rpc("duplicate_quiz", { p_quiz_id: DEMO_QUIZ_ID });
    await host.rpc("create_session", { p_quiz_id: copy!.id });
    const { error } = await host.from("quizzes").delete().eq("id", copy!.id);
    expect(error).toBeNull();
    const db = admin();
    expect((await db.from("rounds").select("id").eq("quiz_id", copy!.id)).data).toEqual([]);
    expect((await db.from("sessions").select("id").eq("quiz_id", copy!.id)).data).toEqual([]);
  });

  it("another host can't duplicate or delete my quiz", async () => {
    const email = `host-mgmt-${Date.now()}@my-kahoot.local`;
    await admin().auth.admin.createUser({ email, password: "host-mgmt-pw", email_confirm: true, app_metadata: { role: "host" } });
    const other = await signedIn(email, "host-mgmt-pw");
    const dup = await other.rpc("duplicate_quiz", { p_quiz_id: DEMO_QUIZ_ID });
    expect(dup.error?.message).toBe("quiz_not_found");
    await other.from("quizzes").delete().eq("id", DEMO_QUIZ_ID);
    const { data } = await admin().from("quizzes").select("id").eq("id", DEMO_QUIZ_ID);
    expect(data).toHaveLength(1); // still there: RLS made the delete match nothing
  });

  it("a player can't duplicate a quiz", async () => {
    const { client } = await anonymousPlayer();
    const { error } = await client.rpc("duplicate_quiz", { p_quiz_id: DEMO_QUIZ_ID });
    expect(error).not.toBeNull();
  });
});
