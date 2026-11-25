/**
 * tests/e2e/question-editor.spec.ts — the host builds a quiz's rounds and questions (KQ-16).
 *
 * Acceptance criteria: add rounds and MC / true-false questions; validation errors in Hebrew;
 * reordering persists after a reload; deleting asks for confirmation.
 */
import { expect, test } from "@playwright/test";
import { t } from "../../strings/he";

const DEMO_HOST = { email: "demo-host@my-kahoot.local", password: "demo-password-123" };

test("build rounds and questions, validate, reorder, delete @smoke", async ({ page }) => {
  await page.goto("/host/login");
  await page.getByLabel(t.login.email).fill(DEMO_HOST.email);
  await page.getByLabel(t.login.password).fill(DEMO_HOST.password);
  await page.getByRole("button", { name: t.login.submit }).click();
  await expect(page).toHaveURL(/\/host$/);

  await page.getByTestId("new-quiz").click();
  await expect(page).toHaveURL(/\/host\/quizzes\/[0-9a-f-]{36}$/);
  await expect(page.getByText(t.editor.noRounds)).toBeVisible();

  // Two rounds; name the first.
  await page.getByTestId("add-round").click();
  await expect(page.getByTestId("round")).toHaveCount(1);
  await page.getByTestId("add-round").click();
  await expect(page.getByTestId("round")).toHaveCount(2);
  const round1 = page.getByTestId("round").nth(0);
  await round1.getByTestId("round-title").fill("פתיחה");
  await round1.getByTestId("round-title-save").click();

  // A multiple-choice question in round 1: fill it in, see validation, then save.
  await round1.getByTestId("add-mc").click();
  await expect(round1.getByTestId("question")).toHaveCount(1);
  const q1 = round1.getByTestId("question").nth(0);
  await q1.getByTestId("question-edit").click();
  await q1.getByLabel(t.editor.question).fill("כמה ספרים יש בתורה?");
  await q1.getByTestId("option-0").fill("5");
  await q1.getByTestId("option-1").fill("5");
  await q1.getByTestId("question-save").click();
  await expect(q1.getByTestId("question-error")).toHaveText(t.editor.errors.duplicateOptions);

  await q1.getByTestId("option-1").fill("7");
  await q1.getByTestId("option-2").fill("24");
  await q1.getByLabel(`${t.editor.correct} 1`).check();
  await q1.getByTestId("time-limit").selectOption("30");
  await q1.getByLabel(t.editor.explanation).fill("חמישה חומשי תורה");
  await q1.getByTestId("question-save").click();
  await expect(q1.getByTestId("question-saved")).toBeVisible();
  await expect(q1.getByTestId("question-text")).toHaveText("כמה ספרים יש בתורה?");

  // A true/false question below it.
  await round1.getByTestId("add-tf").click();
  await expect(round1.getByTestId("question")).toHaveCount(2);
  const q2 = round1.getByTestId("question").nth(1);
  await q2.getByTestId("question-edit").click();
  await q2.getByLabel(t.editor.question).fill("ירושלים היא בירת ישראל");
  await q2.getByLabel("נכון", { exact: true }).check();
  await q2.getByTestId("question-save").click();
  await expect(q2.getByTestId("question-saved")).toBeVisible();

  // Move the true/false question up, and the second round up.
  await q2.getByTestId("move-up").click();
  await expect(round1.getByTestId("question-text").nth(0)).toHaveText("ירושלים היא בירת ישראל");
  await page.getByTestId("round").nth(1).getByTestId("move-up").click();
  await expect(page.getByTestId("round").nth(1).getByTestId("round-title")).toHaveValue("פתיחה");

  // Everything persists after a reload.
  await page.reload();
  const opening = page.getByTestId("round").nth(1);
  await expect(opening.getByTestId("round-title")).toHaveValue("פתיחה");
  await expect(opening.getByTestId("question-text")).toHaveText(["ירושלים היא בירת ישראל", "כמה ספרים יש בתורה?"]);
  const saved = opening.getByTestId("question").nth(1);
  await saved.getByTestId("question-edit").click();
  await expect(saved.getByTestId("option-2")).toHaveValue("24");
  await expect(saved.getByLabel(`${t.editor.correct} 1`)).toBeChecked();
  await expect(saved.getByTestId("time-limit")).toHaveValue("30");

  // Deleting a question asks first.
  const del = opening.getByTestId("question").nth(0).getByTestId("question-delete");
  await del.click();
  await expect(del).toHaveText(t.editor.deleteConfirm);
  await del.click();
  await expect(opening.getByTestId("question")).toHaveCount(1);
});
