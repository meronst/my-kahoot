/**
 * tests/integration/phone-numbers.test.ts — optional phone numbers (KQ-19).
 * Acceptance: never required; numbers older than 30 days are deleted by the daily cron job.
 */
import { describe, expect, it } from "vitest";
import { admin, anonymousPlayer, DEMO_HOST, DEMO_QUIZ_ID, randomPin, signedIn } from "./clients";

/** A lobby session on a copy of the demo quiz, with collect_phone as given. */
async function sessionWithPhones(collect: boolean) {
  const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
  const { data: quiz } = await host.rpc("duplicate_quiz", { p_quiz_id: DEMO_QUIZ_ID });
  await host.from("quizzes").update({ collect_phone: collect }).eq("id", quiz!.id);
  const { data: session, error } = await admin().from("sessions").insert({ quiz_id: quiz!.id, pin: randomPin() }).select().single();
  if (error) throw error;
  return { host, session: session! };
}

async function join(pin: string, nickname: string, phone?: string) {
  const { client } = await anonymousPlayer();
  const result = await client.rpc("join_session", { p_pin: pin, p_nickname: nickname, p_phone: phone });
  return { client, ...result };
}

describe("joining with a phone number", () => {
  it("stores the normalized number with the consent time, only when the quiz asks for it", async () => {
    const { session } = await sessionWithPhones(true);
    const before = Date.now();
    const { data, error } = await join(session.pin, "דנה", "+972 50-123-4567");
    expect(error).toBeNull();
    expect(data!.phone).toBe("0501234567");
    expect(new Date(data!.phone_consent_at!).getTime()).toBeGreaterThanOrEqual(before - 5_000);

    const off = await sessionWithPhones(false);
    const ignored = await join(off.session.pin, "יוסי", "0501234567");
    expect(ignored.error).toBeNull();
    expect(ignored.data!.phone).toBeNull();
  });

  it("is never required, and a bad number is refused with a clear code", async () => {
    const { session } = await sessionWithPhones(true);
    const without = await join(session.pin, "בלי טלפון");
    expect(without.error).toBeNull();
    expect(without.data).toMatchObject({ phone: null, phone_consent_at: null });
    const blank = await join(session.pin, "ריק", "   ");
    expect(blank.error).toBeNull();
    expect(blank.data!.phone).toBeNull();
    const bad = await join(session.pin, "שגוי", "03-1234567");
    expect(bad.error?.message).toBe("phone_invalid");
  });

  it("only the player and the host can read the number", async () => {
    const { host, session } = await sessionWithPhones(true);
    const me = await join(session.pin, "רות", "0509999999");
    const other = await join(session.pin, "אחר");

    expect((await me.client.from("players").select("phone").eq("id", me.data!.id).single()).data!.phone).toBe("0509999999");
    expect((await other.client.from("players").select("phone").eq("id", me.data!.id)).data).toEqual([]);
    const { data: forHost } = await host.from("players").select("nickname, phone").eq("session_id", session.id).not("phone", "is", null);
    expect(forHost).toEqual([{ nickname: "רות", phone: "0509999999" }]);
  });
});

describe("deleting numbers after 30 days", () => {
  it("delete_expired_phones() erases numbers older than 30 days and keeps newer ones", async () => {
    const { session } = await sessionWithPhones(true);
    const old = await join(session.pin, "ישן", "0501111111");
    const recent = await join(session.pin, "חדש", "0502222222");
    const db = admin();
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
    await db.from("players").update({ phone_consent_at: daysAgo(31) }).eq("id", old.data!.id);
    await db.from("players").update({ phone_consent_at: daysAgo(29) }).eq("id", recent.data!.id);

    const { data: erased, error } = await db.rpc("delete_expired_phones");
    expect(error).toBeNull();
    expect(erased).toBeGreaterThanOrEqual(1);

    const { data: rows } = await db.from("players").select("id, phone, phone_consent_at").in("id", [old.data!.id, recent.data!.id]);
    const byId = Object.fromEntries(rows!.map((r) => [r.id, r]));
    expect(byId[old.data!.id]).toMatchObject({ phone: null, phone_consent_at: null });
    expect(byId[recent.data!.id].phone).toBe("0502222222");
  });

  it("runs every day from pg_cron", async () => {
    const { data, error } = await admin().rpc("scheduled_jobs");
    expect(error).toBeNull();
    expect(data).toContainEqual({
      jobname: "delete-expired-phones", schedule: "17 3 * * *", command: "select public.delete_expired_phones()", active: true,
    });
  });

  it("players and hosts can't run the cleanup or see the jobs", async () => {
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    expect((await host.rpc("delete_expired_phones")).error).not.toBeNull();
    expect((await host.rpc("scheduled_jobs")).error).not.toBeNull();
  });
});
