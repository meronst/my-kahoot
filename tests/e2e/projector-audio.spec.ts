/**
 * tests/e2e/projector-audio.spec.ts — projector sounds (KQ-20).
 *
 * Acceptance: no audio on phones; mute persists across reloads.
 * We can't listen in a test, so an init script wraps the browser's AudioContext and counts how many
 * audio contexts and notes (oscillators) the page creates.
 */
import { expect, test, type Page } from "@playwright/test";
import { DEMO_HOST, signedIn } from "../integration/clients";
import { t } from "../../strings/he";

declare global {
  interface Window { __audio: { contexts: number; notes: number } }
}

function countAudio() {
  window.__audio = { contexts: 0, notes: 0 };
  const Original = window.AudioContext;
  if (!Original) return;
  window.AudioContext = class extends Original {
    constructor(options?: AudioContextOptions) {
      super(options);
      window.__audio.contexts++;
    }
    createOscillator() {
      window.__audio.notes++;
      return super.createOscillator();
    }
  };
}
const audio = (page: Page) => page.evaluate(() => window.__audio);

test("music and effects on the projector only; mute is remembered @smoke", async ({ page, browser }) => {
  const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
  const { data: quiz } = await host.from("quizzes").insert({ title: `צלילים ${Date.now()}` }).select().single();
  await host.rpc("import_rounds", {
    p_quiz_id: quiz!.id,
    p_rounds: [{ title: null, questions: [{ type: "tf", text: "שאלה", options: [{ text: "נכון", correct: true }, { text: "לא נכון", correct: false }], time_limit_sec: 20, explanation: null }] }],
  });
  const { data: session } = await host.rpc("create_session", { p_quiz_id: quiz!.id });

  await page.addInitScript(countAudio);
  const consoleErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  await page.goto("/host/login");
  await page.getByLabel(t.login.email).fill(DEMO_HOST.email);
  await page.getByLabel(t.login.password).fill(DEMO_HOST.password);
  await page.getByRole("button", { name: t.login.submit }).click();
  await expect(page).toHaveURL(/\/host$/);
  await page.goto(`/host/sessions/${session!.id}`);

  // Silent until the first click (browser rule); then the lobby music starts.
  const toggle = page.getByTestId("sound-toggle");
  await expect(toggle).toHaveText(t.sound.on);
  expect(await audio(page)).toEqual({ contexts: 0, notes: 0 });
  await page.locator("h1").first().click();
  await expect.poll(async () => (await audio(page)).notes).toBeGreaterThan(0);

  // Mute, reload: still muted, and the lobby stays silent even after a click.
  await toggle.click();
  await expect(toggle).toHaveText(t.sound.off);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(toggle).toHaveText(t.sound.off);
  await page.locator("h1").first().click();
  await page.waitForTimeout(1_000);
  expect((await audio(page)).notes).toBe(0);

  // Unmute: the music comes back.
  await toggle.click();
  await expect(toggle).toHaveText(t.sound.on);
  await expect.poll(async () => (await audio(page)).notes).toBeGreaterThan(0);

  // A phone joins and plays a question: it never creates any audio.
  const phoneContext = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  await phoneContext.addInitScript(countAudio);
  const phone = await phoneContext.newPage();
  await phone.goto(`/j/${session!.pin}`);
  await phone.getByLabel(t.join.nicknameLabel).fill("שקט");
  await phone.getByRole("button", { name: t.join.submit }).click();
  await expect(phone.getByTestId("player-status")).toHaveAttribute("data-realtime", "READY", { timeout: 10_000 });

  const before = (await audio(page)).notes;
  await page.getByTestId("primary-action").click(); // start → question chime on the projector
  await expect(phone.getByRole("button", { name: "נכון", exact: true })).toBeVisible({ timeout: 5_000 });
  await phone.getByRole("button", { name: "נכון", exact: true }).click();
  await expect.poll(async () => (await audio(page)).notes).toBeGreaterThan(before);
  expect(await audio(phone)).toEqual({ contexts: 0, notes: 0 });

  await phoneContext.close();
  // The saved mute value is read only after hydration, so the server and browser HTML agree.
  expect(consoleErrors.filter((e) => e.includes("418") || e.toLowerCase().includes("hydration"))).toEqual([]);
});
