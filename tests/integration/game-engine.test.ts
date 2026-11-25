/**
 * tests/integration/game-engine.test.ts — plays whole games against the real database (KQ-9).
 *
 * KQ-9 acceptance criteria covered here:
 *   - late answer rejected, double answer rejected
 *   - no `correct` flag in the question payload phones receive
 *   - SQL scoring matches lib/scoring.ts (the unit-tested formula)
 * plus the full state machine: start → question → reveal → next → pause (end of round) →
 * resume → … → finished, and who may do what.
 *
 * The demo quiz (supabase/seed.sql): round 0 = [MC 20s, correct=1 "ירושלים"], [TF 15s, correct=0 "נכון"];
 * round 1 = [MC no timer, correct=2 "7"]. Scoring mode: speed.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { scoreAnswer, type ScoringMode } from "@/lib/scoring";
import { admin, anonymousPlayer, DEMO_HOST, DEMO_QUIZ_ID, signedIn, type Db } from "./clients";

type Player = { client: Db; id: string };

async function joinAs(pin: string, nickname: string): Promise<Player> {
  const { client } = await anonymousPlayer();
  const { data, error } = await client.rpc("join_session", { p_pin: pin, p_nickname: nickname });
  if (error) throw error;
  return { client, id: data!.id };
}

/** Moves the question's start time into the past, to simulate a slow answer without waiting. */
async function startedSecondsAgo(sessionId: string, seconds: number) {
  const { error } = await admin().from("sessions")
    .update({ question_started_at: new Date(Date.now() - seconds * 1000).toISOString() }).eq("id", sessionId);
  if (error) throw error;
}

describe("a full game (speed mode)", () => {
  let host: Db;
  let sessionId: string;
  let a: Player; // answers correctly
  let b: Player; // answers wrong

  beforeAll(async () => {
    host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const { data, error } = await host.rpc("create_session", { p_quiz_id: DEMO_QUIZ_ID });
    if (error) throw error;
    sessionId = data!.id;
    a = await joinAs(data!.pin, "אלף");
    b = await joinAs(data!.pin, "בית");
  });

  it("only the host can start", async () => {
    const { error } = await a.client.rpc("start_session", { p_session_id: sessionId });
    expect(error?.message).toBe("not_your_session");
  });

  it("start → first question; the payload phones see has no answer key", async () => {
    const { data, error } = await host.rpc("start_session", { p_session_id: sessionId });
    expect(error).toBeNull();
    expect(data!.status).toBe("question");

    // What a PHONE reads (RLS: player of this session):
    const { data: seen } = await a.client.from("sessions").select("question_payload").eq("id", sessionId).single();
    const payload = seen!.question_payload as Record<string, unknown>;
    expect(payload).toMatchObject({
      type: "mc", text: "איזו עיר היא בירת ישראל?", time_limit_sec: 20,
      options: ["תל אביב", "ירושלים", "חיפה", "באר שבע"],
      round_idx: 0, round_count: 2, question_idx: 0, round_size: 2,
    });
    const raw = JSON.stringify(seen);
    expect(raw).not.toContain("correct");
    expect(raw).not.toContain("explanation");
  });

  it("answers are accepted without revealing whether they're correct", async () => {
    const right = await a.client.rpc("submit_answer", { p_session_id: sessionId, p_option_idx: 1 });
    const wrong = await b.client.rpc("submit_answer", { p_session_id: sessionId, p_option_idx: 0 });
    expect(right.data).toEqual({ accepted: true });
    expect(wrong.data).toEqual({ accepted: true }); // same reply: nothing to learn from it
  });

  it("a double answer is rejected", async () => {
    const { error } = await a.client.rpc("submit_answer", { p_session_id: sessionId, p_option_idx: 2 });
    expect(error?.message).toBe("already_answered");
  });

  it("an option that doesn't exist is rejected (checked before the double-answer rule)", async () => {
    const { error } = await b.client.rpc("submit_answer", { p_session_id: sessionId, p_option_idx: 7 });
    expect(error?.message).toBe("invalid_option");
  });

  it("scores: correct fast answer close to 1000, wrong answer 0", async () => {
    const { data } = await admin().from("players").select("id, score").in("id", [a.id, b.id]);
    const score = Object.fromEntries(data!.map((p) => [p.id, p.score]));
    expect(score[a.id]).toBeGreaterThanOrEqual(900);
    expect(score[a.id]).toBeLessThanOrEqual(1000);
    expect(score[b.id]).toBe(0);
  });

  it("reveal publishes the correct option, counts, leaderboard and each player's result", async () => {
    const { data, error } = await host.rpc("reveal_question", { p_session_id: sessionId });
    expect(error).toBeNull();
    expect(data!.status).toBe("reveal");
    const reveal = data!.reveal_payload as {
      correct_idx: number; counts: number[]; answered: number; players: number; show_scores: boolean;
      explanation: string; leaderboard: { player_id: string; score: number }[];
      results: Record<string, { correct: boolean | null; points: number; score: number }>;
    };
    expect(reveal.correct_idx).toBe(1);
    expect(reveal.counts).toEqual([1, 1, 0, 0]);
    expect(reveal).toMatchObject({ answered: 2, players: 2, show_scores: true, explanation: "ירושלים היא בירת ישראל." });
    expect(reveal.leaderboard[0].player_id).toBe(a.id);
    expect(reveal.results[a.id].correct).toBe(true);
    expect(reveal.results[b.id]).toMatchObject({ correct: false, points: 0, score: 0 });
  });

  it("no answers after the reveal", async () => {
    const { error } = await b.client.rpc("submit_answer", { p_session_id: sessionId, p_option_idx: 1 });
    expect(error?.message).toBe("not_accepting_answers");
  });

  it("two 'next' clicks at the same moment advance only once (row lock)", async () => {
    const [first, second] = await Promise.all([
      host.rpc("next_question", { p_session_id: sessionId }),
      host.rpc("next_question", { p_session_id: sessionId }),
    ]);
    const errors = [first.error, second.error].filter(Boolean);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/invalid_state/);
    const { data } = await admin().from("sessions").select("status, round_idx, question_idx").eq("id", sessionId).single();
    expect(data).toEqual({ status: "question", round_idx: 0, question_idx: 1 });
  });

  it("an answer after the time limit + 1s grace is rejected", async () => {
    await startedSecondsAgo(sessionId, 17); // limit 15s + 1s grace
    const { error } = await a.client.rpc("submit_answer", { p_session_id: sessionId, p_option_idx: 0 });
    expect(error?.message).toBe("too_late");
  });

  it("an answer inside the grace second is accepted at the minimum 500 points", async () => {
    await startedSecondsAgo(sessionId, 15.5);
    const before = (await admin().from("players").select("score").eq("id", b.id).single()).data!.score;
    const { error } = await b.client.rpc("submit_answer", { p_session_id: sessionId, p_option_idx: 0 });
    expect(error).toBeNull();
    const after = (await admin().from("players").select("score").eq("id", b.id).single()).data!.score;
    expect(after - before).toBe(500);
  });

  it("end of round 1 → paused; resume → first question of round 2", async () => {
    await host.rpc("reveal_question", { p_session_id: sessionId });
    const paused = await host.rpc("next_question", { p_session_id: sessionId });
    expect(paused.data).toMatchObject({ status: "paused", round_idx: 1, question_idx: 0 });

    const resumed = await host.rpc("resume_session", { p_session_id: sessionId });
    expect(resumed.data!.status).toBe("question");
    expect(resumed.data!.question_payload).toMatchObject({ round_idx: 1, question_idx: 0, text: "כמה ימים יש בשבוע?" });
  });

  it("no timer: a slow correct answer still gets 1000", async () => {
    await startedSecondsAgo(sessionId, 120);
    const before = (await admin().from("players").select("score").eq("id", a.id).single()).data!.score;
    await a.client.rpc("submit_answer", { p_session_id: sessionId, p_option_idx: 2 });
    const after = (await admin().from("players").select("score").eq("id", a.id).single()).data!.score;
    expect(after - before).toBe(1000);
  });

  it("end of the last round → finished", async () => {
    await host.rpc("reveal_question", { p_session_id: sessionId });
    const { data } = await host.rpc("next_question", { p_session_id: sessionId });
    expect(data!.status).toBe("finished");
  });

  it("a different host can't drive this session", async () => {
    const email = `host-engine-${Date.now()}@my-kahoot.local`;
    await admin().auth.admin.createUser({ email, password: "host-engine-pw", email_confirm: true, app_metadata: { role: "host" } });
    const other = await signedIn(email, "host-engine-pw");
    const { error } = await other.rpc("next_question", { p_session_id: sessionId });
    expect(error?.message).toBe("not_your_session");
  });
});

describe("results mode (no scores)", () => {
  it("scores 0 and publishes no leaderboard", async () => {
    const db = admin();
    const { data: quiz } = await db.from("quizzes")
      .insert({ owner_id: DEMO_HOST.id, title: "סקר", scoring_mode: "results" }).select().single();
    const { data: round } = await db.from("rounds").insert({ quiz_id: quiz!.id, position: 0 }).select().single();
    await db.from("questions").insert({
      round_id: round!.id, position: 0, type: "tf", text: "שאלת סקר", time_limit_sec: 20,
      options: [{ text: "נכון", correct: true }, { text: "לא נכון", correct: false }],
    });
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const { data: session } = await host.rpc("create_session", { p_quiz_id: quiz!.id });
    const p = await joinAs(session!.pin, "סוקר");
    await host.rpc("start_session", { p_session_id: session!.id });
    await p.client.rpc("submit_answer", { p_session_id: session!.id, p_option_idx: 0 });
    const { data } = await host.rpc("reveal_question", { p_session_id: session!.id });
    const reveal = data!.reveal_payload as { show_scores: boolean; leaderboard: unknown[]; counts: number[] };
    expect(reveal).toMatchObject({ show_scores: false, leaderboard: [], counts: [1, 0] });
    const { data: player } = await db.from("players").select("score").eq("id", p.id).single();
    expect(player!.score).toBe(0);
  });

  it("a quiz without questions can't be started", async () => {
    const db = admin();
    const { data: quiz } = await db.from("quizzes").insert({ owner_id: DEMO_HOST.id, title: "ריק" }).select().single();
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const { data: session } = await host.rpc("create_session", { p_quiz_id: quiz!.id });
    const { error } = await host.rpc("start_session", { p_session_id: session!.id });
    expect(error?.message).toBe("quiz_has_no_questions");
  });
});

describe("scoring: SQL and lib/scoring.ts agree", () => {
  const cases: [ScoringMode, boolean, number, number | null][] = [
    ["speed", true, 0, 20], ["speed", true, 7_345, 20], ["speed", true, 20_000, 20], ["speed", true, 21_000, 20],
    ["speed", true, -500, 20], ["speed", true, 5_000, null], ["speed", false, 1_000, 20],
    ["points", true, 9_999, 15], ["points", false, 0, 15], ["results", true, 0, 20],
  ];
  it.each(cases)("%s correct=%s elapsed=%dms limit=%ss", async (mode, correct, elapsed, limit) => {
    const { data, error } = await admin().rpc("score_answer", {
      p_mode: mode, p_correct: correct, p_elapsed_ms: elapsed, p_limit_sec: limit as number,
    });
    expect(error).toBeNull();
    expect(data).toBe(scoreAnswer(mode, correct, elapsed, limit));
  });
});

describe("server_time", () => {
  it("returns the database clock (for phone countdown correction)", async () => {
    const { client } = await anonymousPlayer();
    const { data } = await client.rpc("server_time");
    expect(Math.abs(Date.parse(data as string) - Date.now())).toBeLessThan(30_000);
  });
});
