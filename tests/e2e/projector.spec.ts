/**
 * tests/e2e/projector.spec.ts — the projector screens during a game (KQ-10).
 *
 * Acceptance criterion: host + 3 players complete a question; the projector shows the correct
 * distribution. The players answer through the real database function (submit_answer); their phone
 * screens are KQ-11.
 */
import { expect, test } from "@playwright/test";
import { admin, anonymousPlayer, type Db } from "../integration/clients";
import { t } from "../../strings/he";

const DEMO_HOST = { email: "demo-host@my-kahoot.local", password: "demo-password-123" };

async function joinPlayer(pin: string, nickname: string): Promise<Db> {
  const { client } = await anonymousPlayer();
  const { error } = await client.rpc("join_session", { p_pin: pin, p_nickname: nickname });
  if (error) throw error;
  return client;
}

test("host + 3 players: question, live answer count, auto-reveal with the right distribution @smoke", async ({ page }) => {
  // Host: log in, open a lobby for the demo quiz.
  await page.goto("/host/login");
  await page.getByLabel(t.login.email).fill(DEMO_HOST.email);
  await page.getByLabel(t.login.password).fill(DEMO_HOST.password);
  await page.getByRole("button", { name: t.login.submit }).click();
  await page.getByRole("listitem").filter({ hasText: "חידון לדוגמה" })
    .getByRole("button", { name: t.host.startSession }).click();
  await expect(page.getByTestId("session-pin")).toHaveText(/^\d{6}$/);
  const pin = (await page.getByTestId("session-pin").textContent())!;
  const sessionId = page.url().split("/").pop()!;

  // Three phones join.
  const [p1, p2, p3] = await Promise.all([joinPlayer(pin, "אורי"), joinPlayer(pin, "דנה"), joinPlayer(pin, "Tom")]);
  await expect(page.getByTestId("player-count")).toHaveText("3", { timeout: 5_000 });

  // Start: first question with its options and countdown.
  await page.getByTestId("primary-action").click();
  await expect(page.getByTestId("projector")).toHaveAttribute("data-status", "question");
  await expect(page.getByTestId("projector-question")).toHaveText("איזו עיר היא בירת ישראל?");
  await expect(page.getByTestId("countdown")).toBeVisible();

  // Two answer "ירושלים" (index 1, correct), one answers "תל אביב" (index 0).
  for (const [player, option] of [[p1, 1], [p2, 1], [p3, 0]] as const) {
    const { error } = await player.rpc("submit_answer", { p_session_id: sessionId, p_option_idx: option });
    expect(error).toBeNull();
  }

  // All 3 answered → the projector reveals by itself.
  await expect(page.getByTestId("projector")).toHaveAttribute("data-status", "reveal", { timeout: 5_000 });
  await expect(page.getByTestId("bar-0")).toHaveAttribute("data-count", "1");
  await expect(page.getByTestId("bar-1")).toHaveAttribute("data-count", "2");
  await expect(page.getByTestId("bar-1")).toHaveAttribute("data-correct", "true");
  await expect(page.getByTestId("bar-2")).toHaveAttribute("data-count", "0");
  await expect(page.getByTestId("bar-3")).toHaveAttribute("data-count", "0");
  await expect(page.getByTestId("correct-answer")).toContainText("ירושלים");
  await expect(page.getByTestId("explanation")).toHaveText("ירושלים היא בירת ישראל.");
  await expect(page.getByTestId("leaderboard").getByRole("listitem")).toHaveCount(3);

  // Next question (true/false, 15s). Nobody answers; when time runs out, it reveals by itself.
  await page.getByTestId("primary-action").click();
  await expect(page.getByTestId("projector-question")).toHaveText(/ים המלח/);
  // Instead of waiting 15 real seconds, move the question's start time back in the database.
  await admin().from("sessions")
    .update({ question_started_at: new Date(Date.now() - 16_000).toISOString() }).eq("id", sessionId);
  await expect(page.getByTestId("projector")).toHaveAttribute("data-status", "reveal", { timeout: 6_000 });
  await expect(page.getByTestId("bar-0")).toHaveAttribute("data-count", "0");
  await expect(page.getByTestId("bar-0")).toHaveAttribute("data-correct", "true");

  // End of round 1 → pause.
  await page.getByTestId("primary-action").click();
  await expect(page.getByTestId("projector")).toHaveAttribute("data-status", "paused");
});
