/**
 * vitest.config.mts (.mts = TypeScript as an ES module) — configuration for Vitest, the unit and integration test runner.
 *
 * Vitest is the JavaScript world's JUnit/pytest: `describe` = test class, `it` = test method,
 * `expect(x).toBe(y)` = assertEquals.
 *
 * Two "projects" share this one config:
 *  - unit:        fast tests of pure logic, no network or DB (tests/unit)
 *  - integration: tests against a real local Supabase (tests/integration), wired up in KQ-4
 * `make test-unit` and `make test-integration` run each project separately.
 */
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Same "@/..." import alias as tsconfig.json, so tests import code exactly like the app does.
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        extends: true,
        test: { name: "integration", include: ["tests/integration/**/*.test.ts"], environment: "node" },
      },
    ],
  },
});
