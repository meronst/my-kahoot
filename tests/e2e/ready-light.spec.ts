/**
 * tests/e2e/ready-light.spec.ts — the "system ready" light on /host (KQ-21).
 * Acceptance: the indicator turns red when the database is unreachable.
 */
import { expect, test } from "@playwright/test";
import { t } from "../../strings/he";

const DEMO_HOST = { email: "demo-host@my-kahoot.local", password: "demo-password-123" };

test("green when the database answers, red when it doesn't @smoke", async ({ page }) => {
  await page.goto("/host/login");
  await page.getByLabel(t.login.email).fill(DEMO_HOST.email);
  await page.getByLabel(t.login.password).fill(DEMO_HOST.password);
  await page.getByRole("button", { name: t.login.submit }).click();
  await expect(page).toHaveURL(/\/host$/);

  const light = page.getByTestId("ready-light");
  await expect(light).toHaveAttribute("data-state", "ready");
  await expect(light).toHaveText(t.ready.ok);

  // Cut the browser off from the database (the page itself still loads from our server), then
  // re-check by bringing the tab back into view.
  await page.route("**/rest/v1/rpc/health", (route) => route.abort("connectionrefused"));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(light).toHaveAttribute("data-state", "down");
  await expect(light).toHaveText(t.ready.down);

  // Back online: green again.
  await page.unroute("**/rest/v1/rpc/health");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(light).toHaveAttribute("data-state", "ready");
});
