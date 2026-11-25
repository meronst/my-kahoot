/**
 * tests/unit/strings.test.ts — sanity checks for the UI strings file.
 *
 * Catches two easy mistakes: an empty string left behind, and an English placeholder
 * shipped where Hebrew was expected.
 */
import { describe, expect, it } from "vitest";
import { he } from "@/strings/he";

/** Walks the nested strings object and returns every leaf as [path, value]. */
function leaves(obj: object, prefix = ""): Array<[string, string]> {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === "string"
      ? [[`${prefix}${key}`, value] as [string, string]]
      : leaves(value as object, `${prefix}${key}.`),
  );
}

describe("strings/he", () => {
  it("has no empty strings", () => {
    for (const [path, value] of leaves(he)) {
      expect(value.trim(), `string at ${path} is empty`).not.toBe("");
    }
  });

  it("every string contains Hebrew letters", () => {
    // ֐-׿ is the Unicode block for Hebrew.
    const hebrew = /[֐-׿]/;
    for (const [path, value] of leaves(he)) {
      expect(hebrew.test(value), `string at ${path} has no Hebrew: "${value}"`).toBe(true);
    }
  });
});
