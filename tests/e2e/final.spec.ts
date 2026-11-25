/**
 * tests/e2e/final.spec.ts — the end of the game on the projector and the phone (KQ-14).
 *
 * Acceptance criteria: ranks match total scores; results mode shows no podium.
 */
import { expect, test } from "@playwright/test";
import { admin, anonymousPlayer, DEMO_HOST, signedIn } from "../integration/clients";
import { t } from "../../strings/he";

async function loginHost(page: import("@playwright/test").Page) {
  await page.goto("/host/login");
  await page.getByLabel(t.login.email).fill(DEMO_HOST.email);
  await page.getByLabel(t.login.password).fill(DEMO_HOST.password);
  await page.getByRole("button", { name: t.login.submit }).click();
  await expect(page).toHaveURL(/\/host$/);
}

test("ending early: podium on the projector, place X of N on the phone @smoke", async ({ page: projector, browser }) => {
  await loginHost(projector);
  await projector.getByRole("listitem").filter({ hasText: "חידון לדוגמה" })
    .getByRole("button", { name: t.host.startSession }).click();
  const pin = (await projector.getByTestId("session-pin").textContent())!;
  const sessionId = projector.url().split("/").pop()!;

  // One real phone + two players through the API.
  const phoneContext = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const phone = await phoneContext.newPage();
  await phone.goto(`/j/${pin}`);
  await phone.getByLabel(t.join.nicknameLabel).fill("רוני");
  await phone.getByRole("button", { name: t.join.submit }).click();
  await expect(phone.getByTestId("player-game")).toBeVisible();
  for (const name of ["שני", "שלישי"]) {
    const { client } = await anonymousPlayer();
    await client.rpc("join_session", { p_pin: pin, p_nickname: name });
  }
  await expect(projector.getByTestId("player-count")).toHaveText("3", { timeout: 5_000 });

  // Give everyone a known total so the expected ranks are clear: רוני 3000, שלישי 2000, שני 1000.
  const db = admin();
  for (const [name, score] of [["רוני", 3000], ["שני", 1000], ["שלישי", 2000]] as const) {
    await db.from("players").update({ score }).eq("session_id", sessionId).eq("nickname", name);
  }

  // Start, reveal (no one answers), then end early: two clicks on "end".
  await projector.getByTestId("primary-action").click();
  await expect(projector.getByTestId("projector")).toHaveAttribute("data-status", "question");
  await projector.getByTestId("primary-action").click();
  await expect(projector.getByTestId("projector")).toHaveAttribute("data-status", "reveal");
  await projector.getByTestId("end-early").click();
  await expect(projector.getByTestId("end-early")).toHaveText(t.projector.endEarlyConfirm);
  await projector.getByTestId("end-early").click();
  await expect(projector.getByTestId("projector")).toHaveAttribute("data-status", "finished");

  // Podium: ranks follow the scores.
  await expect(projector.getByTestId("podium-rank-1")).toContainText("רוני");
  await expect(projector.getByTestId("podium-rank-1")).toContainText("3000");
  await expect(projector.getByTestId("podium-rank-2")).toContainText("שלישי");
  await expect(projector.getByTestId("podium-rank-3")).toContainText("שני");

  // The phone shows its final place.
  await expect(phone.getByTestId("final-rank")).toHaveText(`${t.play.yourPlace}: 1 ${t.play.outOf} 3`, { timeout: 5_000 });
  await expect(phone.getByTestId("player-score")).toHaveText("3000");
  await phoneContext.close();
});

test("results mode: the end screen has no podium and phones show no rank @smoke", async ({ page: projector, browser }) => {
  const db = admin();
  const { data: quiz } = await db.from("quizzes")
    .insert({ owner_id: DEMO_HOST.id, title: `סקר ${Date.now()}`, scoring_mode: "results" }).select().single();
  const { data: round } = await db.from("rounds").insert({ quiz_id: quiz!.id, position: 0 }).select().single();
  await db.from("questions").insert({
    round_id: round!.id, position: 0, type: "tf", text: "שאלת סקר", time_limit_sec: 20,
    options: [{ text: "נכון", correct: true }, { text: "לא נכון", correct: false }],
  });
  const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
  const { data: session } = await host.rpc("create_session", { p_quiz_id: quiz!.id });

  const phoneContext = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const phone = await phoneContext.newPage();
  await phone.goto(`/j/${session!.pin}`);
  await phone.getByLabel(t.join.nicknameLabel).fill("סוקר");
  await phone.getByRole("button", { name: t.join.submit }).click();
  await expect(phone.getByTestId("player-game")).toBeVisible();

  await host.rpc("start_session", { p_session_id: session!.id });
  await host.rpc("reveal_question", { p_session_id: session!.id });
  await host.rpc("next_question", { p_session_id: session!.id }); // last question → finished

  await loginHost(projector);
  await projector.goto(`/host/sessions/${session!.id}`);
  await expect(projector.getByTestId("finished")).toBeVisible();
  await expect(projector.getByTestId("podium")).toHaveCount(0);
  await expect(projector.getByText(t.projector.thanks)).toBeVisible();

  await expect(phone.getByTestId("player-status")).toHaveText(t.play.ended, { timeout: 5_000 });
  await expect(phone.getByTestId("final-rank")).toHaveCount(0);
  await expect(phone.getByTestId("player-score")).toHaveCount(0);
  await phoneContext.close();
});
