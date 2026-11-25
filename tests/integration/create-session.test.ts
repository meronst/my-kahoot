/**
 * tests/integration/create-session.test.ts — the create_session() database function (KQ-7).
 */
import { describe, expect, it } from "vitest";
import { admin, anonymousPlayer, DEMO_HOST, DEMO_QUIZ_ID, signedIn } from "./clients";

describe("create_session", () => {
  it("host starts a session: 6-digit PIN, status lobby, 24h expiry", async () => {
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const { data, error } = await host.rpc("create_session", { p_quiz_id: DEMO_QUIZ_ID });
    expect(error).toBeNull();
    expect(data!.pin).toMatch(/^[1-9][0-9]{5}$/);
    expect(data!.status).toBe("lobby");
    const hours = (Date.parse(data!.expires_at) - Date.parse(data!.created_at)) / 3_600_000;
    expect(hours).toBeCloseTo(24, 5);
  });

  it("gives different PINs to sessions running at the same time", async () => {
    const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
    const pins = new Set<string>();
    for (let i = 0; i < 15; i++) {
      const { data, error } = await host.rpc("create_session", { p_quiz_id: DEMO_QUIZ_ID });
      expect(error).toBeNull();
      pins.add(data!.pin);
    }
    expect(pins.size).toBe(15);
  });

  it("a player (anonymous) cannot start a session", async () => {
    const { client } = await anonymousPlayer();
    const { data, error } = await client.rpc("create_session", { p_quiz_id: DEMO_QUIZ_ID });
    expect(data).toBeNull();
    expect(error?.message).toMatch(/only the host/);
  });

  it("a different host cannot start a session on someone else's quiz", async () => {
    const email = `host3-${Date.now()}@my-kahoot.local`;
    await admin().auth.admin.createUser({
      email, password: "host3-password", email_confirm: true, app_metadata: { role: "host" },
    });
    const otherHost = await signedIn(email, "host3-password");
    const { error } = await otherHost.rpc("create_session", { p_quiz_id: DEMO_QUIZ_ID });
    expect(error).not.toBeNull(); // blocked by the sessions RLS policy (not the owner of the quiz)
  });
});
