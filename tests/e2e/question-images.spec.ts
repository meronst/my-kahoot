/**
 * tests/e2e/question-images.spec.ts — images in questions (KQ-17).
 *
 * Acceptance criteria: a 6 MB photo uploads as < 500 KB; the image appears on both screens.
 * The "photo" is drawn in the browser (gradient + circles + grain, 4000×3000, ~6 MB JPEG), so the
 * repo needs no big test file.
 */
import { expect, test } from "@playwright/test";
import { DEMO_HOST, signedIn } from "../integration/clients";
import { t } from "../../strings/he";

test("a 6 MB photo uploads small and shows on the projector and the phone @smoke", async ({ page, browser }) => {
  await page.goto("/host/login");
  await page.getByLabel(t.login.email).fill(DEMO_HOST.email);
  await page.getByLabel(t.login.password).fill(DEMO_HOST.password);
  await page.getByRole("button", { name: t.login.submit }).click();
  await expect(page).toHaveURL(/\/host$/);

  // A quiz with one round and one question.
  await page.getByTestId("new-quiz").click();
  await expect(page).toHaveURL(/\/host\/quizzes\/[0-9a-f-]{36}$/);
  const quizId = page.url().split("/").pop()!;
  await page.getByTestId("add-round").click();
  await page.getByTestId("add-mc").click();
  await page.getByTestId("question-edit").click();

  // Draw a big photo-like JPEG and hand it to the file input, as if picked from disk.
  const originalSize = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 4000;
    c.height = 3000;
    const x = c.getContext("2d")!;
    const g = x.createLinearGradient(0, 0, 4000, 3000);
    g.addColorStop(0, "#3a7bd5");
    g.addColorStop(1, "#f4d03f");
    x.fillStyle = g;
    x.fillRect(0, 0, 4000, 3000);
    for (let i = 0; i < 400; i++) {
      x.fillStyle = `hsl(${(i * 37) % 360} 60% 50% / .5)`;
      x.beginPath();
      x.arc((i * 997) % 4000, (i * 613) % 3000, 40 + (i % 200), 0, 7);
      x.fill();
    }
    const img = x.getImageData(0, 0, 4000, 3000);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 50;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    x.putImageData(img, 0, 0);
    const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.95));
    const input = document.querySelector<HTMLInputElement>('[data-testid="image-input"]')!;
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "photo.jpg", { type: "image/jpeg" }));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return blob.size;
  });
  expect(originalSize).toBeGreaterThan(6 * 1024 * 1024);

  // Uploaded: the stored file is under 500 KB and at most 1600px wide.
  const editorImage = page.getByTestId("editor-image");
  await expect(editorImage).toBeVisible({ timeout: 15_000 });
  const src = (await editorImage.getAttribute("src"))!;
  const stored = await page.request.get(src);
  expect(stored.status()).toBe(200);
  expect((await stored.body()).length).toBeLessThan(500 * 1024);
  expect(await editorImage.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1600);

  // Play it: a phone joins, the host starts, both screens show the image.
  const host = await signedIn(DEMO_HOST.email, DEMO_HOST.password);
  const { data: session, error } = await host.rpc("create_session", { p_quiz_id: quizId });
  expect(error).toBeNull();

  const phoneContext = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, locale: "he-IL" });
  const phone = await phoneContext.newPage();
  await phone.goto(`/j/${session!.pin}`);
  await phone.getByLabel(t.join.nicknameLabel).fill("תמר");
  await phone.getByRole("button", { name: t.join.submit }).click();
  await expect(phone.getByTestId("player-status")).toHaveAttribute("data-realtime", "READY", { timeout: 10_000 });

  await page.goto(`/host/sessions/${session!.id}`);
  await page.getByTestId("primary-action").click();
  await expect(page.getByTestId("projector-image")).toBeVisible();
  await expect(page.getByTestId("projector-image")).toHaveAttribute("src", src);
  await expect(phone.getByTestId("phone-image")).toBeVisible({ timeout: 5_000 });
  await expect(phone.getByTestId("phone-image")).toHaveAttribute("src", src);
  // The phone actually loaded it (naturalWidth is 0 for a broken image).
  await expect.poll(() => phone.getByTestId("phone-image").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1600);

  await phoneContext.close();
});
