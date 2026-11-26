/**
 * tests/integration/session-expiry.test.ts — sessions end after 24 hours (KQ-21).
 * Acceptance: an expired session can't be joined; expired games are finished by the cron job.
 */
import { describe, expect, it } from "vitest";
import { admin, anonymousPlayer, DEMO_HOST, DEMO_QUIZ_ID, signedIn } from "./clients";

const past = () => new Date(Date.now() - 60_000).toISOString();

describe("session expiry", () => {
  it("an expired session can't be joined, even before the cleanup runs", async () => {
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const { data: session } = await host.rpc("create_session", { p_quiz_id: DEMO_QUIZ_ID });
    await admin().from("sessions").update({ expires_at: past() }).eq("id", session!.id);

    const { client } = await anonymousPlayer();
    const { error } = await client.rpc("join_session", { p_pin: session!.pin, p_nickname: "מאוחר" });
    expect(error?.message).toBe("session_ended");
    const { data: preview } = await client.rpc("session_preview", { p_pin: session!.pin });
    expect(preview![0].is_open).toBe(false);
  });

  it("expire_sessions() finishes expired games with a final ranking, and leaves live ones alone", async () => {
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const { data: old } = await host.rpc("create_session", { p_quiz_id: DEMO_QUIZ_ID });
    const { client } = await anonymousPlayer();
    await client.rpc("join_session", { p_pin: old!.pin, p_nickname: "נשאר" });
    await host.rpc("start_session", { p_session_id: old!.id });
    const { data: live } = await host.rpc("create_session", { p_quiz_id: DEMO_QUIZ_ID });
    await admin().from("sessions").update({ expires_at: past() }).eq("id", old!.id);

    const { data: count, error } = await admin().rpc("expire_sessions");
    expect(error).toBeNull();
    expect(count).toBeGreaterThanOrEqual(1);

    const { data: rows } = await admin().from("sessions").select("id, status, final_payload").in("id", [old!.id, live!.id]);
    const byId = Object.fromEntries(rows!.map((r) => [r.id, r]));
    expect(byId[old!.id].status).toBe("finished");
    expect(byId[old!.id].final_payload).toMatchObject({ players: 1 });
    expect(byId[live!.id].status).toBe("lobby");
  });

  it("runs every 15 minutes from pg_cron, and only the system may run it", async () => {
    const { data } = await admin().rpc("scheduled_jobs");
    expect(data).toContainEqual({ jobname: "expire-sessions", schedule: "*/15 * * * *", command: "select public.expire_sessions()", active: true });
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    expect((await host.rpc("expire_sessions")).error).not.toBeNull();
  });
});
