/**
 * tests/e2e/quiz-management.spec.ts — the host creates, edits, duplicates and deletes quizzes (KQ-15).
 *
 * Acceptance criteria: settings persist; deleting asks for confirmation.
 */
import { expect, test } from "@playwright/test";
import { t } from "../../strings/he";

const DEMO_HOST = { email: "demo-host@my-kahoot.local", password: "demo-password-123" };

test("create a quiz, save settings, duplicate it, delete with confirmation @smoke", async ({ page }) => {
  await page.goto("/host/login");
  await page.getByLabel(t.login.email).fill(DEMO_HOST.email);
  await page.getByLabel(t.login.password).fill(DEMO_HOST.password);
  await page.getByRole("button", { name: t.login.submit }).click();
  await expect(page).toHaveURL(/\/host$/);

  // New quiz → its edit page with default settings.
  await page.getByTestId("new-quiz").click();
  await expect(page).toHaveURL(/\/host\/quizzes\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("quiz-heading")).toHaveText(t.quiz.defaultTitle);

  // Change every setting and save.
  const title = `מגילות ים המלח ${Date.now() % 100000}`;
  await page.getByLabel(t.quiz.title).fill(title);
  await page.getByLabel(t.quiz.modes.points).check();
  await page.getByLabel(t.quiz.collectPhone).check();
  await page.getByRole("button", { name: t.quiz.save }).click();
  await expect(page.getByTestId("settings-saved")).toBeVisible();

  // Settings persist across a reload.
  await page.reload();
  await expect(page.getByLabel(t.quiz.title)).toHaveValue(title);
  await expect(page.getByLabel(t.quiz.modes.points)).toBeChecked();
  await expect(page.getByLabel(t.quiz.collectPhone)).toBeChecked();
  await expect(page.getByTestId("quiz-heading")).toHaveText(title);

  // An empty title is refused.
  await page.getByLabel(t.quiz.title).fill(" ");
  await page.getByRole("button", { name: t.quiz.save }).click();
  await expect(page.getByTestId("settings-error")).toHaveText(t.quiz.titleRequired);
  // KQ-30 regression: a failed save keeps what was typed (React used to reset the form).
  await expect(page.getByLabel(t.quiz.title)).toHaveValue(" ");

  // Back on the list: the quiz is there with its mode.
  await page.getByRole("link", { name: t.quiz.backToList }).click();
  const row = page.getByTestId("quiz-row").filter({ hasText: title });
  await expect(row).toContainText(t.quiz.modes.points);

  // Duplicate → a copy appears.
  await row.getByTestId("duplicate-quiz").click();
  const copy = page.getByTestId("quiz-row").filter({ hasText: `עותק של ${title}` });
  await expect(copy).toHaveCount(1);

  // Delete asks for confirmation: first click only arms the button.
  await copy.getByTestId("delete-quiz").click();
  await expect(copy.getByTestId("delete-quiz")).toHaveText(t.host.deleteConfirm);
  await expect(copy).toHaveCount(1);
  await copy.getByTestId("delete-quiz").click();
  await expect(page.getByTestId("quiz-row").filter({ hasText: `עותק של ${title}` })).toHaveCount(0);
  await expect(row).toHaveCount(1); // the original is untouched
});
