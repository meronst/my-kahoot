/**
 * tests/e2e/pause-resume.spec.ts — a whole lecture flow across real browsers (KQ-13).
 *
 * Acceptance criterion (@smoke): join → answer → reveal → pause → resume → answer.
 * Three browsers: the projector (host), a phone that plays from the start, and a late joiner who
 * arrives during the pause (allowed by the rules).
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { t } from "../../strings/he";

const DEMO_HOST = { email: "demo-host@my-kahoot.local", password: "demo-password-123" };

async function phone(browser: Browser, pin: string, nickname: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(`/j/${pin}`);
  await page.getByLabel(t.join.nicknameLabel).fill(nickname);
  await page.getByRole("button", { name: t.join.submit }).click();
  await expect(page.getByTestId("player-game")).toBeVisible();
  return page;
}

test("join → answer → reveal → pause → resume → answer, with a late joiner @smoke", async ({ page: projector, browser }) => {
  // Projector: host opens a lobby.
  await projector.goto("/host/login");
  await projector.getByLabel(t.login.email).fill(DEMO_HOST.email);
  await projector.getByLabel(t.login.password).fill(DEMO_HOST.password);
  await projector.getByRole("button", { name: t.login.submit }).click();
  await projector.getByRole("listitem").filter({ hasText: "חידון לדוגמה" })
    .getByRole("button", { name: t.host.startSession }).click();
  const pin = (await projector.getByTestId("session-pin").textContent())!;
  const status = projector.getByTestId("projector");

  // A phone joins and the host starts.
  const leah = await phone(browser, pin, "ליה");
  await expect(projector.getByTestId("player-count")).toHaveText("1", { timeout: 5_000 });
  await projector.getByTestId("primary-action").click();

  // Round 1, question 1: answer → everyone answered → auto-reveal.
  await expect(leah.getByTestId("phone-question")).toBeVisible({ timeout: 5_000 });
  await leah.getByTestId("answer-1").tap();
  await expect(status).toHaveAttribute("data-status", "reveal", { timeout: 5_000 });
  await expect(leah.getByTestId("phone-result")).toHaveAttribute("data-outcome", "correct", { timeout: 5_000 });

  // Round 1, question 2 (true/false), then end of round → pause.
  await projector.getByTestId("primary-action").click();
  await leah.getByTestId("answer-0").tap({ timeout: 5_000 });
  await expect(status).toHaveAttribute("data-status", "reveal", { timeout: 5_000 });
  await projector.getByTestId("primary-action").click();
  await expect(status).toHaveAttribute("data-status", "paused");

  // Pause screen: standings, next round, PIN for late joiners. The phone shows the break.
  await expect(projector.getByTestId("standings")).toContainText("ליה");
  await expect(projector.getByTestId("next-round")).toContainText("2");
  await expect(projector.getByTestId("session-pin")).toHaveText(pin);
  await expect(leah.getByTestId("player-status")).toHaveText(t.play.paused, { timeout: 5_000 });

  // Someone arrives during the break and joins.
  const late = await phone(browser, pin, "מאוחר");
  await expect(late.getByTestId("player-status")).toHaveText(t.play.paused);
  await expect(projector.getByTestId("player-count")).toHaveCount(0); // lobby list isn't shown while paused

  // Resume → round 2: both phones get the question; both answer → auto-reveal.
  await projector.getByTestId("primary-action").click();
  await expect(status).toHaveAttribute("data-status", "question");
  await expect(leah.getByTestId("phone-question")).toHaveText("כמה ימים יש בשבוע?", { timeout: 5_000 });
  await expect(late.getByTestId("phone-question")).toHaveText("כמה ימים יש בשבוע?", { timeout: 5_000 });
  await leah.getByTestId("answer-2").tap();
  await late.getByTestId("answer-2").tap();
  await expect(status).toHaveAttribute("data-status", "reveal", { timeout: 5_000 });
  await expect(projector.getByTestId("bar-2")).toHaveAttribute("data-count", "2");
  await expect(late.getByTestId("phone-result")).toHaveAttribute("data-outcome", "correct", { timeout: 5_000 });

  // Last question of the last round → finished on both screens.
  await projector.getByTestId("primary-action").click();
  await expect(status).toHaveAttribute("data-status", "finished");
  await expect(leah.getByTestId("player-status")).toHaveText(t.play.ended, { timeout: 5_000 });
});
