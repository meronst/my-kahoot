/**
 * tests/unit/scoring.test.ts — the scoring formula (KQ-9 acceptance criterion).
 */
import { describe, expect, it } from "vitest";
import { scoreAnswer } from "@/lib/scoring";

describe("scoreAnswer: speed mode", () => {
  it("instant correct answer → 1000", () => expect(scoreAnswer("speed", true, 0, 20)).toBe(1000));
  it("halfway → 750", () => expect(scoreAnswer("speed", true, 10_000, 20)).toBe(750));
  it("at the deadline → 500", () => expect(scoreAnswer("speed", true, 20_000, 20)).toBe(500));
  it("inside the 1s grace period still counts as the deadline → 500", () =>
    expect(scoreAnswer("speed", true, 20_800, 20)).toBe(500));
  it("a phone clock slightly ahead (negative elapsed) → 1000, not more", () =>
    expect(scoreAnswer("speed", true, -300, 20)).toBe(1000));
  it("no timer → 1000", () => expect(scoreAnswer("speed", true, 45_000, null)).toBe(1000));
  it("wrong → 0", () => expect(scoreAnswer("speed", false, 0, 20)).toBe(0));
});

describe("scoreAnswer: points and results modes", () => {
  it("points: correct → 1000 regardless of speed", () => {
    expect(scoreAnswer("points", true, 0, 20)).toBe(1000);
    expect(scoreAnswer("points", true, 19_000, 20)).toBe(1000);
  });
  it("points: wrong → 0", () => expect(scoreAnswer("points", false, 0, 20)).toBe(0));
  it("results: always 0", () => {
    expect(scoreAnswer("results", true, 0, 20)).toBe(0);
    expect(scoreAnswer("results", false, 0, 20)).toBe(0);
  });
});
