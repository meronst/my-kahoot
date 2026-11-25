/**
 * tests/e2e/join.spec.ts — a participant joins from a phone (KQ-8).
 *
 * Acceptance criteria:
 *   - the join screen shows the title of the quiz being played
 *   - a duplicate nickname is rejected with a message
 *   - reload returns the same player and score
 *   - an expired or finished session shows "this quiz has ended"
 */
import { expect, test, type Page } from "@playwright/test";
import { admin, DEMO_QUIZ_ID, randomPin } from "../integration/clients";
import { t } from "../../strings/he";

/** A fresh session on the demo quiz; returns its id and PIN. */
async function newSession(status: "lobby" | "finished" = "lobby") {
  const { data, error } = await admin()
    .from("sessions").insert({ quiz_id: DEMO_QUIZ_ID, pin: randomPin(), status }).select().single();
  if (error) throw error;
  return data;
}

async function join(page: Page, pin: string, nickname: string) {
  await page.goto(`/j/${pin}`);
  await page.getByLabel(t.join.nicknameLabel).fill(nickname);
  await page.getByRole("button", { name: t.join.submit }).click();
}

test("home page: a typed PIN opens the join screen @smoke", async ({ page }) => {
  const session = await newSession();
  await page.goto("/");
  await page.getByLabel(t.home.pinLabel).fill("12");
  await page.getByRole("button", { name: t.home.go }).click();
  await expect(page.getByTestId("pin-error")).toHaveText(t.home.pinInvalid);

  await page.getByLabel(t.home.pinLabel).fill(session.pin);
  await page.getByRole("button", { name: t.home.go }).click();
  await expect(page).toHaveURL(new RegExp(`/j/${session.pin}$`));
});

test("join screen shows the quiz title; joined player keeps name and score after reload @smoke", async ({ page }) => {
  const session = await newSession();
  await page.goto(`/j/${session.pin}`);
  await expect(page.getByTestId("quiz-title")).toHaveText("חידון לדוגמה");

  await join(page, session.pin, "מיכל");
  await expect(page).toHaveURL(new RegExp(`/play/${session.id}$`));
  await expect(page.getByTestId("player-nickname")).toHaveText("מיכל");
  await expect(page.getByTestId("player-status")).toHaveText(t.play.waitingToStart);

  // Simulate points earned, then reload: same player, same score.
  await admin().from("players").update({ score: 850 }).eq("session_id", session.id);
  await page.reload();
  await expect(page.getByTestId("player-nickname")).toHaveText("מיכל");
  await expect(page.getByTestId("player-score")).toHaveText("850");

  // Scanning the QR again (opening /j/<PIN>) goes straight back to the player screen.
  await page.goto(`/j/${session.pin}`);
  await expect(page).toHaveURL(new RegExp(`/play/${session.id}$`));
});

test("a duplicate nickname is rejected with a Hebrew message @smoke", async ({ page, browser }) => {
  const session = await newSession();
  await join(page, session.pin, "יוסי");
  await expect(page).toHaveURL(new RegExp(`/play/${session.id}$`));

  // A second phone = a separate browser context (its own cookies, its own anonymous login).
  const secondPhone = await browser.newContext();
  const page2 = await secondPhone.newPage();
  await join(page2, session.pin, "יוסי");
  await expect(page2.getByTestId("join-error")).toHaveText(t.join.errors.nicknameTaken);
  await expect(page2).toHaveURL(new RegExp(`/j/${session.pin}$`));
  await secondPhone.close();
});

test("a finished session shows 'this quiz has ended' @smoke", async ({ page }) => {
  const session = await newSession("finished");
  await page.goto(`/j/${session.pin}`);
  await expect(page.getByTestId("join-closed")).toHaveText(t.join.ended);
});

test("an expired session shows 'this quiz has ended'", async ({ page }) => {
  const session = await newSession();
  await admin().from("sessions").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", session.id);
  await page.goto(`/j/${session.pin}`);
  await expect(page.getByTestId("join-closed")).toHaveText(t.join.ended);
});

test("the phone follows the game state live (pause, end)", async ({ page }) => {
  const session = await newSession();
  await join(page, session.pin, "שרה");
  const status = page.getByTestId("player-status");
  await expect(status).toHaveAttribute("data-realtime", "READY", { timeout: 10_000 });

  await admin().from("sessions").update({ status: "paused" }).eq("id", session.id);
  await expect(status).toHaveText(t.play.paused, { timeout: 5_000 });

  await admin().from("sessions").update({ status: "finished" }).eq("id", session.id);
  await expect(status).toHaveText(t.play.ended, { timeout: 5_000 });
});
