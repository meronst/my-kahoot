/**
 * tests/integration/final-results.test.ts — final ranks, podium and ending early (KQ-14).
 *
 * Acceptance criteria: ranks match total scores; results mode shows no podium.
 */
import { describe, expect, it } from "vitest";
import { admin, anonymousPlayer, DEMO_HOST, DEMO_QUIZ_ID, signedIn, type Db } from "./clients";

type Final = {
  show_scores: boolean;
  players: number;
  podium: { player_id: string; nickname: string; score: number; rank: number }[];
  ranks: Record<string, { rank: number; score: number }>;
};

async function join(pin: string, nickname: string): Promise<{ client: Db; id: string }> {
  const { client } = await anonymousPlayer();
  const { data, error } = await client.rpc("join_session", { p_pin: pin, p_nickname: nickname });
  if (error) throw error;
  return { client, id: data!.id };
}

/** Plays the demo quiz to the end without answers; scores are then set directly. */
async function playToEnd(host: Db, sessionId: string) {
  await host.rpc("start_session", { p_session_id: sessionId });
  for (let step = 0; step < 10; step++) {
    const { data } = await admin().from("sessions").select("status").eq("id", sessionId).single();
    if (data!.status === "finished") return;
    if (data!.status === "question") await host.rpc("reveal_question", { p_session_id: sessionId });
    else if (data!.status === "reveal") await host.rpc("next_question", { p_session_id: sessionId });
    else if (data!.status === "paused") await host.rpc("resume_session", { p_session_id: sessionId });
  }
}

describe("final results", () => {
  it("ranks match total scores; ties share a rank; podium = top 3", async () => {
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const { data: session } = await host.rpc("create_session", { p_quiz_id: DEMO_QUIZ_ID });
    const players = await Promise.all(["א", "ב", "ג", "ד"].map((n) => join(session!.pin, n)));
    const scores = [1500, 2700, 1500, 300];
    for (const [i, p] of players.entries()) {
      await admin().from("players").update({ score: scores[i] }).eq("id", p.id);
    }

    await playToEnd(host, session!.id);
    // Scores were set before the end; the last reveals don't change them (nobody answered).
    const { data } = await admin().from("sessions").select("status, final_payload").eq("id", session!.id).single();
    expect(data!.status).toBe("finished");
    const final = data!.final_payload as Final;

    expect(final.players).toBe(4);
    expect(final.ranks[players[1].id]).toEqual({ rank: 1, score: 2700 });
    expect(final.ranks[players[0].id]).toEqual({ rank: 2, score: 1500 });
    expect(final.ranks[players[2].id]).toEqual({ rank: 2, score: 1500 }); // tie
    expect(final.ranks[players[3].id]).toEqual({ rank: 4, score: 300 });  // 3 is skipped
    expect(final.podium.map((p) => p.score)).toEqual([2700, 1500, 1500]);
    expect(final.show_scores).toBe(true);

    // A player can read their own final rank (via the session row they're allowed to read).
    const { data: seen } = await players[3].client.from("sessions").select("final_payload").eq("id", session!.id).single();
    expect((seen!.final_payload as Final).ranks[players[3].id].rank).toBe(4);
  });

  it("results mode: no podium, no scores", async () => {
    const db = admin();
    const { data: quiz } = await db.from("quizzes")
      .insert({ owner_id: DEMO_HOST.id, title: "סקר סיום", scoring_mode: "results" }).select().single();
    const { data: round } = await db.from("rounds").insert({ quiz_id: quiz!.id, position: 0 }).select().single();
    await db.from("questions").insert({
      round_id: round!.id, position: 0, type: "tf", text: "שאלה", time_limit_sec: 20,
      options: [{ text: "נכון", correct: true }, { text: "לא נכון", correct: false }],
    });
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const { data: session } = await host.rpc("create_session", { p_quiz_id: quiz!.id });
    await join(session!.pin, "משתתף");
    await host.rpc("start_session", { p_session_id: session!.id });
    await host.rpc("reveal_question", { p_session_id: session!.id });
    const { data } = await host.rpc("next_question", { p_session_id: session!.id });
    expect(data!.status).toBe("finished");
    expect(data!.final_payload).toMatchObject({ show_scores: false, podium: [], players: 1 });
  });

  it("the host can end early between questions, but not during one", async () => {
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const { data: session } = await host.rpc("create_session", { p_quiz_id: DEMO_QUIZ_ID });
    await join(session!.pin, "מוקדם");
    await host.rpc("start_session", { p_session_id: session!.id });

    const during = await host.rpc("finish_session", { p_session_id: session!.id });
    expect(during.error?.message).toMatch(/invalid_state/);

    await host.rpc("reveal_question", { p_session_id: session!.id });
    const ended = await host.rpc("finish_session", { p_session_id: session!.id });
    expect(ended.error).toBeNull();
    expect(ended.data!.status).toBe("finished");
    expect(ended.data!.final_payload).toMatchObject({ players: 1 });
  });

  it("a player can't end the game", async () => {
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const { data: session } = await host.rpc("create_session", { p_quiz_id: DEMO_QUIZ_ID });
    const p = await join(session!.pin, "שובב");
    const { error } = await p.client.rpc("finish_session", { p_session_id: session!.id });
    expect(error?.message).toBe("not_your_session");
  });
});
