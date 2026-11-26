/**
 * tests/e2e/phone-numbers.spec.ts — the optional phone number and its export (KQ-19).
 *
 * Acceptance: never required. (Deletion after 30 days: tests/integration/phone-numbers.test.ts.
 * "Never logged": the CI E2E job searches every log for the number used here, 054-777-0019.)
 */
import { expect, test } from "@playwright/test";
import { DEMO_HOST, DEMO_QUIZ_ID, signedIn } from "../integration/clients";
import { t } from "../../strings/he";

test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

test("phone field only when asked, optional, validated; the host can get the numbers @smoke", async ({ page, browser }) => {
  const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
  // Its own quiz with its own title: E2E tests share one database and run in parallel, and other
  // tests find the demo quiz by name (a copy named "עותק של חידון לדוגמה" would match them too).
  const { data: quiz } = await host.from("quizzes").insert({ title: `טלפונים ${Date.now()}`, collect_phone: true }).select().single();
  await host.rpc("import_rounds", {
    p_quiz_id: quiz!.id,
    p_rounds: [{ title: null, questions: [{ type: "tf", text: "שאלה", options: [{ text: "נכון", correct: true }, { text: "לא נכון", correct: false }], time_limit_sec: null, explanation: null }] }],
  });
  const { data: session } = await host.rpc("create_session", { p_quiz_id: quiz!.id });

  // Phone 1: the field and its consent line are there; a landline is refused; a mobile works.
  await page.goto(`/j/${session!.pin}`);
  await expect(page.getByTestId("phone-consent")).toHaveText(t.join.phoneConsent);
  await page.getByLabel(t.join.nicknameLabel).fill("מיכל");
  await page.getByLabel(t.join.phoneLabel).fill("03-1234567");
  await page.getByRole("button", { name: t.join.submit }).click();
  await expect(page.getByTestId("join-error")).toHaveText(t.join.errors.phoneInvalid);
  await page.getByLabel(t.join.phoneLabel).fill("054-777-0019");
  await page.getByRole("button", { name: t.join.submit }).click();
  await expect(page).toHaveURL(new RegExp(`/play/${session!.id}$`));

  // Phone 2: leaves it empty and still joins (never required).
  const other = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page2 = await other.newPage();
  await page2.goto(`/j/${session!.pin}`);
  await page2.getByLabel(t.join.nicknameLabel).fill("אורי");
  await page2.getByRole("button", { name: t.join.submit }).click();
  await expect(page2).toHaveURL(new RegExp(`/play/${session!.id}$`));
  await other.close();

  // A quiz that doesn't collect numbers shows no phone field.
  const { data: plain } = await host.rpc("create_session", { p_quiz_id: DEMO_QUIZ_ID });
  const third = await browser.newContext();
  const page3 = await third.newPage();
  await page3.goto(`/j/${plain!.pin}`);
  await expect(page3.getByLabel(t.join.nicknameLabel)).toBeVisible();
  await expect(page3.getByLabel(t.join.phoneLabel)).toHaveCount(0);

  // The host ends the game; the numbers are available from the host-only CSV address.
  await host.rpc("finish_session", { p_session_id: session!.id });
  await page3.goto("/host/login");
  await page3.getByLabel(t.login.email).fill(DEMO_HOST.email);
  await page3.getByLabel(t.login.password).fill(DEMO_HOST.password);
  await page3.getByRole("button", { name: t.login.submit }).click();
  await expect(page3).toHaveURL(/\/host$/);
  await page3.goto(`/host/sessions/${session!.id}`);
  await expect(page3.getByTestId("finished")).toBeVisible();
  await expect(page3.getByText("CSV")).toHaveCount(0); // KQ-32: nothing about phones on the projector
  const res0 = await page3.request.get(`/host/sessions/${session!.id}/phones`);
  expect(res0.headers()["content-disposition"]).toBe(`attachment; filename="phones-${session!.pin}.csv"`);
  const text = await res0.text();
  expect(text.replace(/^﻿/, "").split("\r\n").slice(0, 2)).toEqual([
    `${t.phones.nickname},${t.phones.phone},${t.phones.consentDate}`,
    expect.stringMatching(/^מיכל,0547770019,\d\d\/\d\d\/\d{4}$/),
  ]);
  await third.close();

  // Without a host login, the export refuses.
  const anon = await browser.newContext();
  const res = await anon.request.get(`/host/sessions/${session!.id}/phones`, { maxRedirects: 0 });
  expect(res.status()).not.toBe(200);
  await anon.close();
});
