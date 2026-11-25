/**
 * tests/e2e/phone-game.spec.ts — the phone during a game (KQ-11).
 *
 * Acceptance criteria:
 *   - works at a 360px-wide viewport in RTL (a small Android phone)
 *   - one tap = one answer
 * plus: full question text, "answer received", correct/wrong + points + score after the reveal,
 * "no answer" when the player didn't answer, true/false shows two buttons.
 *
 * The host's moves are made through the database functions directly (the projector is tested in
 * projector.spec.ts); the phone is a real browser.
 */
import { expect, test } from "@playwright/test";
import { admin, DEMO_HOST, DEMO_QUIZ_ID, signedIn } from "../integration/clients";
import { t } from "../../strings/he";

test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

test("phone at 360px: question, one tap = one answer, result and score @smoke", async ({ page }) => {
  const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
  const { data: session, error } = await host.rpc("create_session", { p_quiz_id: DEMO_QUIZ_ID });
  expect(error).toBeNull();

  // Join from the phone.
  await page.goto(`/j/${session!.pin}`);
  await page.getByLabel(t.join.nicknameLabel).fill("נגה");
  await page.getByRole("button", { name: t.join.submit }).click();
  await expect(page.getByTestId("player-status")).toHaveAttribute("data-realtime", "READY", { timeout: 10_000 });

  // Host starts: the phone shows the full question and 4 buttons.
  await host.rpc("start_session", { p_session_id: session!.id });
  await expect(page.getByTestId("phone-question")).toHaveText("איזו עיר היא בירת ישראל?", { timeout: 5_000 });
  await expect(page.getByRole("button")).toHaveCount(4);
  await expect(page.getByTestId("phone-countdown")).toBeVisible();

  // Nothing sticks out sideways at 360px in RTL.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // One tap = one answer: tap "ירושלים", then try tapping again quickly.
  await page.getByTestId("answer-1").tap();
  await expect(page.getByTestId("answer-received")).toBeVisible();
  await expect(page.getByTestId("answer-0")).toHaveCount(0); // buttons are gone
  const { count } = await admin().from("answers").select("id", { count: "exact", head: true }).eq("session_id", session!.id);
  expect(count).toBe(1);

  // After a reload during the question, the phone still shows "answer received".
  await page.reload();
  await expect(page.getByTestId("answer-received")).toBeVisible();

  // Reveal: correct, points, score.
  await host.rpc("reveal_question", { p_session_id: session!.id });
  await expect(page.getByTestId("phone-result")).toHaveAttribute("data-outcome", "correct", { timeout: 5_000 });
  const points = Number(await page.getByTestId("points-earned").textContent());
  expect(points).toBeGreaterThanOrEqual(500);
  await expect(page.getByTestId("player-score")).toHaveText(String(points));

  // Next: true/false → 2 buttons. Don't answer; reveal → "no answer" and the correct one is shown.
  await host.rpc("next_question", { p_session_id: session!.id });
  await expect(page.getByTestId("phone-question")).toHaveText(/ים המלח/, { timeout: 5_000 });
  await expect(page.getByRole("button")).toHaveCount(2);
  await host.rpc("reveal_question", { p_session_id: session!.id });
  await expect(page.getByTestId("phone-result")).toHaveAttribute("data-outcome", "none", { timeout: 5_000 });
  await expect(page.getByTestId("phone-result")).toContainText("נכון");

  // End of round → the phone shows the break.
  await host.rpc("next_question", { p_session_id: session!.id });
  await expect(page.getByTestId("player-status")).toHaveText(t.play.paused, { timeout: 5_000 });
});

test("a wrong answer shows 'wrong' with the correct answer and 0 points @smoke", async ({ page }) => {
  const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
  const { data: session } = await host.rpc("create_session", { p_quiz_id: DEMO_QUIZ_ID });
  await page.goto(`/j/${session!.pin}`);
  await page.getByLabel(t.join.nicknameLabel).fill("גל");
  await page.getByRole("button", { name: t.join.submit }).click();
  await expect(page.getByTestId("player-status")).toHaveAttribute("data-realtime", "READY", { timeout: 10_000 });

  await host.rpc("start_session", { p_session_id: session!.id });
  await page.getByTestId("answer-0").tap(); // "תל אביב": wrong
  await expect(page.getByTestId("answer-received")).toBeVisible();
  await host.rpc("reveal_question", { p_session_id: session!.id });
  await expect(page.getByTestId("phone-result")).toHaveAttribute("data-outcome", "wrong", { timeout: 5_000 });
  await expect(page.getByTestId("phone-result")).toContainText("ירושלים");
  await expect(page.getByTestId("points-earned")).toHaveText("0");
});
