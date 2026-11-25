/**
 * tests/integration/player-join.test.ts — session_preview() and join_session() (KQ-8).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { admin, anonymousPlayer, DEMO_QUIZ_ID, randomPin, visitor } from "./clients";

/** A fresh session on the demo quiz, created with the admin client. */
async function newSession(status: "lobby" | "question" | "paused" | "finished" = "lobby") {
  const pin = randomPin();
  const { data, error } = await admin()
    .from("sessions").insert({ quiz_id: DEMO_QUIZ_ID, pin, status }).select().single();
  if (error) throw error;
  return data;
}

describe("session_preview (before joining)", () => {
  it("a not-logged-in visitor sees only the quiz title and that it's open", async () => {
    const session = await newSession();
    const { data, error } = await visitor().rpc("session_preview", { p_pin: session.pin });
    expect(error).toBeNull();
    expect(data).toEqual([
      { session_id: session.id, quiz_title: "חידון לדוגמה", collect_phone: false, status: "lobby", is_open: true },
    ]);
  });

  it("a finished session is reported as closed", async () => {
    const session = await newSession("finished");
    const { data } = await visitor().rpc("session_preview", { p_pin: session.pin });
    expect(data?.[0]?.is_open).toBe(false);
  });

  it("an expired session is reported as closed", async () => {
    const session = await newSession();
    await admin().from("sessions").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", session.id);
    const { data } = await visitor().rpc("session_preview", { p_pin: session.pin });
    expect(data?.[0]?.is_open).toBe(false);
  });

  it("an unknown PIN returns nothing", async () => {
    const { data } = await visitor().rpc("session_preview", { p_pin: "000000" });
    expect(data).toEqual([]);
  });
});

describe("join_session", () => {
  let session: Awaited<ReturnType<typeof newSession>>;
  beforeEach(async () => {
    session = await newSession();
  });

  it("an anonymous player joins with a nickname", async () => {
    const { client, userId } = await anonymousPlayer();
    const { data, error } = await client.rpc("join_session", { p_pin: session.pin, p_nickname: "  נועה  " });
    expect(error).toBeNull();
    expect(data).toMatchObject({ session_id: session.id, user_id: userId, nickname: "נועה", score: 0 });
  });

  it("a duplicate nickname in the same session is rejected", async () => {
    const a = await anonymousPlayer();
    const b = await anonymousPlayer();
    await a.client.rpc("join_session", { p_pin: session.pin, p_nickname: "אבי" });
    const { error } = await b.client.rpc("join_session", { p_pin: session.pin, p_nickname: "אבי" });
    expect(error?.message).toBe("nickname_taken");
  });

  it("reconnect: the same login joining again gets the same player and score", async () => {
    const { client } = await anonymousPlayer();
    const first = await client.rpc("join_session", { p_pin: session.pin, p_nickname: "רון" });
    await admin().from("players").update({ score: 1700 }).eq("id", first.data!.id);
    // Even mid-game, and even with a different nickname typed, the player gets back in as themselves.
    await admin().from("sessions").update({ status: "question" }).eq("id", session.id);
    const again = await client.rpc("join_session", { p_pin: session.pin, p_nickname: "משהו אחר" });
    expect(again.error).toBeNull();
    expect(again.data).toMatchObject({ id: first.data!.id, nickname: "רון", score: 1700 });
  });

  it("a new player can't join in the middle of a round", async () => {
    await admin().from("sessions").update({ status: "question" }).eq("id", session.id);
    const { client } = await anonymousPlayer();
    const { error } = await client.rpc("join_session", { p_pin: session.pin, p_nickname: "מאחר" });
    expect(error?.message).toBe("session_in_progress");
  });

  it("a new player can join during a pause between rounds", async () => {
    await admin().from("sessions").update({ status: "paused" }).eq("id", session.id);
    const { client } = await anonymousPlayer();
    const { error } = await client.rpc("join_session", { p_pin: session.pin, p_nickname: "בהפסקה" });
    expect(error).toBeNull();
  });

  it("a finished session can't be joined", async () => {
    const finished = await newSession("finished");
    const { client } = await anonymousPlayer();
    const { error } = await client.rpc("join_session", { p_pin: finished.pin, p_nickname: "מאוחר מדי" });
    expect(error?.message).toBe("session_ended");
  });

  it("empty or too-long nicknames are rejected", async () => {
    const { client } = await anonymousPlayer();
    expect((await client.rpc("join_session", { p_pin: session.pin, p_nickname: "   " })).error?.message)
      .toBe("nickname_invalid");
    expect((await client.rpc("join_session", { p_pin: session.pin, p_nickname: "א".repeat(21) })).error?.message)
      .toBe("nickname_invalid");
  });

  it("a visitor who isn't signed in can't join", async () => {
    const { error } = await visitor().rpc("join_session", { p_pin: session.pin, p_nickname: "אורח" });
    expect(error).not.toBeNull();
  });

  it("after joining, the player can read their session (RLS: is_player_in)", async () => {
    const { client } = await anonymousPlayer();
    await client.rpc("join_session", { p_pin: session.pin, p_nickname: "קוראת" });
    const { data } = await client.from("sessions").select("id, status").eq("id", session.id);
    expect(data).toEqual([{ id: session.id, status: "lobby" }]);
  });
});
