/**
 * tests/e2e/lobby.spec.ts — starting a session and the live lobby (KQ-7).
 *
 * Acceptance criterion: a player joining shows up on the lobby screen within 2 seconds.
 * The join page itself is KQ-8, so here the test plays the phone's part directly in the database:
 * it signs in an anonymous player and inserts their player row (with the admin client).
 */
import { expect, test } from "@playwright/test";
import { admin, anonymousPlayer } from "../integration/clients";
import { t } from "../../strings/he";

const DEMO_HOST = { email: "demo-host@my-kahoot.local", password: "demo-password-123" };

test("host starts a session; a joining player appears in the lobby within 2s @smoke", async ({ page }) => {
  // Log in and start the demo quiz.
  await page.goto("/host/login");
  await page.getByLabel(t.login.email).fill(DEMO_HOST.email);
  await page.getByLabel(t.login.password).fill(DEMO_HOST.password);
  await page.getByRole("button", { name: t.login.submit }).click();
  await expect(page).toHaveURL(/\/host$/);

  await page.getByRole("listitem").filter({ hasText: "חידון לדוגמה" })
    .getByRole("button", { name: t.host.startSession }).click();

  // Lobby: 6-digit PIN, QR code, nobody joined yet.
  await expect(page).toHaveURL(/\/host\/sessions\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("session-pin")).toHaveText(/^[1-9][0-9]{5}$/);
  await expect(page.getByTestId("join-qr").locator("svg")).toBeVisible();
  await expect(page.getByText(t.lobby.waitingForPlayers)).toBeVisible();

  // Wait until the lobby's live subscription is ready (it re-loads the list once subscribed);
  // a fixed short pause keeps the timing measurement below about the event itself.
  await page.waitForTimeout(1500);

  // A "phone" joins: anonymous sign-in + player row for this session.
  const sessionId = page.url().split("/").pop()!;
  const player = await anonymousPlayer();
  const nickname = `דנה ${Date.now() % 1000}`;
  const { error } = await admin().from("players").insert({ session_id: sessionId, user_id: player.userId, nickname });
  expect(error).toBeNull();

  // Must appear within 2 seconds, without reloading the page.
  await expect(page.getByTestId("lobby-players").getByText(nickname)).toBeVisible({ timeout: 2000 });
  await expect(page.getByTestId("player-count")).toHaveText("1");
});
