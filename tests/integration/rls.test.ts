/**
 * tests/integration/rls.test.ts — proves the Row Level Security rules from the game_schema migration.
 *
 * KQ-5 acceptance criteria:
 *   - a player cannot read `questions` (the answer keys)
 *   - a player cannot read other players' answers
 * plus the rest of the access rules, so a future migration can't quietly open a hole.
 *
 * Pattern for every test: ARRANGE data with the admin client (bypasses RLS), then ACT as a
 * specific user and ASSERT what that user can and can't see.
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  admin, anonymousPlayer, DEMO_HOST, DEMO_QUIZ_ID, randomPin, signedIn, visitor, type Db,
} from "./clients";

// Shared fixture: one session on the demo quiz with two players (A and B) who each answered.
let host: Db;
let playerA: { client: Db; userId: string };
let playerB: { client: Db; userId: string };
let sessionId: string;
let otherSessionId: string;
let playerAId: string;

beforeAll(async () => {
  const db = admin();
  host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
  playerA = await anonymousPlayer();
  playerB = await anonymousPlayer();

  const { data: session, error: sErr } = await db
    .from("sessions").insert({ quiz_id: DEMO_QUIZ_ID, pin: randomPin() }).select().single();
  if (sErr) throw sErr;
  sessionId = session.id;

  const { data: other, error: oErr } = await db
    .from("sessions").insert({ quiz_id: DEMO_QUIZ_ID, pin: randomPin() }).select().single();
  if (oErr) throw oErr;
  otherSessionId = other.id;

  const { data: players, error: pErr } = await db.from("players").insert([
    { session_id: sessionId, user_id: playerA.userId, nickname: "שחקן א" },
    { session_id: sessionId, user_id: playerB.userId, nickname: "שחקן ב" },
  ]).select();
  if (pErr) throw pErr;
  playerAId = players.find((p) => p.user_id === playerA.userId)!.id;

  const { data: question, error: qErr } = await db
    .from("questions").select("id").eq("position", 0).limit(1).single();
  if (qErr) throw qErr;
  const { error: aErr } = await db.from("answers").insert(players.map((p) => ({
    session_id: sessionId, player_id: p.id, question_id: question.id,
    option_idx: 1, is_correct: true, points: 900,
  })));
  if (aErr) throw aErr;
});

describe("host (email + password)", () => {
  it("reads the questions of their quiz, including answer keys", async () => {
    const { data, error } = await host.from("questions").select("text, options");
    expect(error).toBeNull();
    expect(data).toHaveLength(3);
  });

  it("reads all players and answers of their session", async () => {
    const players = await host.from("players").select("id").eq("session_id", sessionId);
    const answers = await host.from("answers").select("id").eq("session_id", sessionId);
    expect(players.data).toHaveLength(2);
    expect(answers.data).toHaveLength(2);
  });

  it("can create a quiz, owned by them automatically", async () => {
    const { data, error } = await host.from("quizzes").insert({ title: "חידון בדיקה" }).select().single();
    expect(error).toBeNull();
    expect(data?.owner_id).toBe(DEMO_HOST.id);
  });
});

describe("a second host", () => {
  it("sees none of the first host's quizzes or questions", async () => {
    const email = `host2-${Date.now()}@my-kahoot.local`;
    const { error } = await admin().auth.admin.createUser({ email, password: "host2-password", email_confirm: true });
    expect(error).toBeNull();
    const host2 = await signedIn(email, "host2-password");
    expect((await host2.from("quizzes").select("id")).data).toEqual([]);
    expect((await host2.from("questions").select("id")).data).toEqual([]);
  });
});

describe("player (anonymous sign-in)", () => {
  it("cannot read questions — the answer keys stay hidden", async () => {
    const { data, error } = await playerA.client.from("questions").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot read quizzes or rounds", async () => {
    expect((await playerA.client.from("quizzes").select("*")).data).toEqual([]);
    expect((await playerA.client.from("rounds").select("*")).data).toEqual([]);
  });

  it("cannot read other players' answers (or any answers)", async () => {
    const { data } = await playerA.client.from("answers").select("*");
    expect(data).toEqual([]);
  });

  it("sees only their own player row, not other players' rows", async () => {
    const { data } = await playerA.client.from("players").select("id, user_id");
    expect(data).toEqual([{ id: playerAId, user_id: playerA.userId }]);
  });

  it("reads the session they joined, but not another session", async () => {
    const { data } = await playerA.client.from("sessions").select("id");
    expect(data?.map((s) => s.id)).toEqual([sessionId]);
    expect(data?.map((s) => s.id)).not.toContain(otherSessionId);
  });

  it("cannot create a quiz", async () => {
    const { error } = await playerA.client.from("quizzes").insert({ title: "פריצה" });
    expect(error).not.toBeNull();
  });

  it("cannot insert an answer directly (only via submit_answer in KQ-9)", async () => {
    const { error } = await playerB.client.from("answers").insert({
      session_id: sessionId, player_id: playerAId, question_id: sessionId, option_idx: 0, is_correct: true,
    });
    expect(error).not.toBeNull();
  });
});

describe("visitor (not logged in)", () => {
  it("is denied every game table", async () => {
    const client = visitor();
    for (const table of ["quizzes", "rounds", "questions", "sessions", "players", "answers"] as const) {
      const { data, error } = await client.from(table).select("*");
      // Either an explicit permission error or no rows: both mean nothing leaks.
      expect(error !== null || (data ?? []).length === 0, `visitor read ${table}`).toBe(true);
    }
  });
});

describe("question validation (CHECK constraint)", () => {
  const roundId = "33333333-3333-3333-3333-333333333302";
  const base = { round_id: roundId, type: "mc" as const, text: "שאלת בדיקה" };

  it("rejects a question with two correct answers", async () => {
    const { error } = await admin().from("questions").insert({
      ...base, position: 10,
      options: [{ text: "א", correct: true }, { text: "ב", correct: true }],
    });
    expect(error?.message).toMatch(/questions_options_valid/);
  });

  it("rejects a true/false question with three options", async () => {
    const { error } = await admin().from("questions").insert({
      ...base, type: "tf", position: 11,
      options: [{ text: "נכון", correct: true }, { text: "לא נכון", correct: false }, { text: "אולי", correct: false }],
    });
    expect(error?.message).toMatch(/questions_options_valid/);
  });

  it("rejects an empty option text", async () => {
    const { error } = await admin().from("questions").insert({
      ...base, position: 12,
      options: [{ text: " ", correct: true }, { text: "ב", correct: false }],
    });
    expect(error?.message).toMatch(/questions_options_valid/);
  });
});
