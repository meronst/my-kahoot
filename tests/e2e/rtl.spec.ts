/**
 * tests/e2e/rtl.spec.ts — checks KQ-2's acceptance criterion in a real browser:
 * pages render in Hebrew, right-to-left.
 *
 * Tagged @smoke, so it also runs in the quick E2E pass on every PR into a version branch.
 */
import { expect, test } from "@playwright/test";
import { t } from "../../strings/he";

test("home page renders in Hebrew, right-to-left @smoke", async ({ page }) => {
  await page.goto("/");

  const html = page.locator("html");
  await expect(html).toHaveAttribute("lang", "he");
  await expect(html).toHaveAttribute("dir", "rtl");

  // The heading text comes from the strings file, so the test doesn't duplicate the wording.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.home.title);

  // Computed style proves the direction really applies (not just the attribute).
  const direction = await page.locator("body").evaluate((el) => getComputedStyle(el).direction);
  expect(direction).toBe("rtl");
});
