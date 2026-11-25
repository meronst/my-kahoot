/**
 * tests/unit/game-progress.test.ts — progressKey orders game states (projector never goes backwards)
 * and secondsLeft for the server-clock countdown.
 */
import { describe, expect, it } from "vitest";
import { progressKey } from "@/lib/game-types";
import { secondsLeft } from "@/lib/use-countdown";

const s = (status: "lobby" | "question" | "reveal" | "paused" | "finished", round_idx = 0, question_idx = 0) =>
  ({ status, round_idx, question_idx });

describe("progressKey", () => {
  it("increases along a whole game, including pause and resume", () => {
    const game = [
      s("lobby"), s("question", 0, 0), s("reveal", 0, 0), s("question", 0, 1), s("reveal", 0, 1),
      s("paused", 1, 0), s("question", 1, 0), s("reveal", 1, 0), s("finished", 1, 0),
    ];
    for (let i = 1; i < game.length; i++) {
      expect(progressKey(game[i]), `${game[i - 1].status} → ${game[i].status}`).toBeGreaterThan(progressKey(game[i - 1]));
    }
  });
  it("a late 'question' row can't replace its own 'reveal'", () => {
    expect(progressKey(s("question", 0, 3))).toBeLessThan(progressKey(s("reveal", 0, 3)));
  });
});

describe("secondsLeft", () => {
  it("rounds up and never goes below zero", () => {
    expect(secondsLeft(0, 20, 0)).toBe(20);
    expect(secondsLeft(0, 20, 19_001)).toBe(1);
    expect(secondsLeft(0, 20, 20_000)).toBe(0);
    expect(secondsLeft(0, 20, 25_000)).toBe(0);
  });
});
