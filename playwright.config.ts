/**
 * playwright.config.ts — end-to-end (E2E) tests: a real browser clicks through the real app.
 *
 * How it runs:
 *  - `webServer` builds and starts the app (`next start`) before the tests, then stops it.
 *  - Every test runs twice: on a phone-sized screen (participants) and a desktop (projector).
 *  - locale he-IL + Asia/Jerusalem, like the real audience.
 *
 * E2E_SCOPE=smoke runs only tests tagged @smoke (quick check on PRs into release/*);
 * E2E_SCOPE=full runs everything (PRs into main).
 *
 * PW_CHROME_PATH lets a machine without Playwright's own browser use an installed Chrome
 * (e.g. /usr/bin/google-chrome). CI leaves it unset and installs Playwright's browser.
 */
import { defineConfig, devices } from "@playwright/test";

const scope = process.env.E2E_SCOPE ?? "full";
const executablePath = process.env.PW_CHROME_PATH || undefined;
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  grep: scope === "smoke" ? /@smoke/ : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // a forgotten `test.only` fails CI instead of skipping the other tests
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    trace: "retain-on-failure",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
