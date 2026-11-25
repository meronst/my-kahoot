/**
 * tests/e2e/host-login.spec.ts — host login in a real browser against the local Supabase (KQ-6).
 *
 * Acceptance criteria:
 *   - a logged-out visitor to /host is redirected to the login page
 *   - a wrong password shows a Hebrew error
 * plus the happy path: the demo host (supabase/seed.sql) logs in, sees /host, and logs out.
 */
import { expect, test } from "@playwright/test";
import { t } from "../../strings/he";

const DEMO_HOST = { email: "demo-host@my-kahoot.local", password: "demo-password-123" };

test("logged-out visitor to /host is redirected to the login page @smoke", async ({ page }) => {
  await page.goto("/host");
  await expect(page).toHaveURL(/\/host\/login$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.login.title);
});

test("wrong password shows a Hebrew error @smoke", async ({ page }) => {
  await page.goto("/host/login");
  await page.getByLabel(t.login.email).fill(DEMO_HOST.email);
  await page.getByLabel(t.login.password).fill("not-the-password");
  await page.getByRole("button", { name: t.login.submit }).click();

  // By test id: Next.js adds its own hidden role="alert" element (route announcer), see bug KQ-26.
  await expect(page.getByTestId("login-error")).toHaveText(t.login.errors.invalidCredentials);
  await expect(page).toHaveURL(/\/host\/login$/);
  // The email stays filled in so the host only retypes the password.
  await expect(page.getByLabel(t.login.email)).toHaveValue(DEMO_HOST.email);
});

test("host logs in, sees the host area, and logs out @smoke", async ({ page }) => {
  await page.goto("/host/login");
  await page.getByLabel(t.login.email).fill(DEMO_HOST.email);
  await page.getByLabel(t.login.password).fill(DEMO_HOST.password);
  await page.getByRole("button", { name: t.login.submit }).click();

  await expect(page).toHaveURL(/\/host$/);
  await expect(page.getByTestId("host-email")).toHaveText(DEMO_HOST.email);

  await page.getByRole("button", { name: t.host.signOut }).click();
  await expect(page).toHaveURL(/\/host\/login$/);

  // After logging out, /host is closed again.
  await page.goto("/host");
  await expect(page).toHaveURL(/\/host\/login$/);
});
