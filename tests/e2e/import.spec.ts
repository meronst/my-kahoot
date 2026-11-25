/**
 * tests/e2e/import.spec.ts — importing questions from Excel/CSV (KQ-18).
 *
 * Acceptance criteria: a valid template imports correctly; a broken row shows its row number and
 * reason, and nothing is saved.
 */
import { expect, test } from "@playwright/test";
import { t } from "../../strings/he";

const DEMO_HOST = { email: "demo-host@my-kahoot.local", password: "demo-password-123" };

test("import the Excel template; a broken CSV shows row errors and saves nothing @smoke", async ({ page }) => {
  await page.goto("/host/login");
  await page.getByLabel(t.login.email).fill(DEMO_HOST.email);
  await page.getByLabel(t.login.password).fill(DEMO_HOST.password);
  await page.getByRole("button", { name: t.login.submit }).click();
  await page.getByTestId("new-quiz").click();
  await expect(page).toHaveURL(/\/host\/quizzes\/[0-9a-f-]{36}$/);

  // The template is downloadable from the page.
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: t.import.templateXlsx }).click();
  expect((await download).suggestedFilename()).toBe("quiz-template.xlsx");

  // A broken CSV: row 3 has an unknown type, row 4 marks answer 5. Nothing is saved.
  const csv = [
    "סבב,שאלה,סוג,תשובה 1,תשובה 2,תשובה נכונה",
    "1,תקינה,אמריקאית,א,ב,1",
    "1,שבורה,חיבור,א,ב,1",
    "1,שבורה,אמריקאית,א,ב,5",
  ].join("\n");
  await page.getByTestId("import-file").setInputFiles({ name: "broken.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByTestId("import-error")).toHaveText([
    `${t.import.row} 3: ${t.import.errors.type}`,
    `${t.import.row} 4: ${t.import.errors.correctMc}`,
  ]);
  await expect(page.getByTestId("import-preview")).toHaveCount(0);
  await expect(page.getByTestId("round")).toHaveCount(0);

  // The real template: preview, confirm, and the rounds appear in the editor.
  await page.getByTestId("import-file").setInputFiles("public/templates/quiz-template.xlsx");
  await expect(page.getByTestId("import-round-count")).toHaveText("2");
  await expect(page.getByTestId("import-question-count")).toHaveText("3");
  await expect(page.getByTestId("round")).toHaveCount(0); // not saved before confirming
  await page.getByTestId("import-confirm").click();
  await expect(page.getByTestId("import-done")).toBeVisible();
  await expect(page.getByTestId("round")).toHaveCount(2);
  await expect(page.getByTestId("round").nth(0).getByTestId("round-title")).toHaveValue("פתיחה");
  await expect(page.getByTestId("round").nth(0).getByTestId("question-text"))
    .toHaveText(["איזו עיר היא בירת ישראל?", "ים המלח הוא המקום הנמוך ביותר ביבשה"]);

  // Saved for real: still there after a reload, with the right answer and timer.
  await page.reload();
  const first = page.getByTestId("round").nth(0).getByTestId("question").nth(0);
  await first.getByTestId("question-edit").click();
  await expect(first.getByTestId("option-1")).toHaveValue("ירושלים");
  await expect(first.getByLabel(`${t.editor.correct} 2`)).toBeChecked();
  await expect(first.getByTestId("time-limit")).toHaveValue("20");
});
