/**
 * tests/unit/sound-plan.test.ts — when the projector makes sounds, and the remembered mute switch (KQ-20).
 */
import { describe, expect, it } from "vitest";
import { effectForTransition, musicFor, MUTE_KEY, readMuted, tickFor, writeMuted } from "@/lib/sound-plan";

describe("sound plan", () => {
  it("plays music only while people join or chat", () => {
    expect(musicFor("lobby")).toBe(true);
    expect(musicFor("paused")).toBe(true);
    expect(musicFor("question")).toBe(false);
    expect(musicFor("reveal")).toBe(false);
    expect(musicFor("finished")).toBe(false);
  });

  it("plays one effect per new state, nothing on the first render or a repeated state", () => {
    expect(effectForTransition(null, "question")).toBeNull(); // reopening the page mid-game: silence
    expect(effectForTransition("lobby", "question")).toBe("question");
    expect(effectForTransition("reveal", "question")).toBe("question");
    expect(effectForTransition("question", "reveal")).toBe("reveal");
    expect(effectForTransition("reveal", "finished")).toBe("finale");
    expect(effectForTransition("reveal", "paused")).toBeNull();
    expect(effectForTransition("question", "question")).toBeNull();
  });

  it("ticks during the last 5 seconds only", () => {
    expect([null, 10, 6, 5, 3, 1, 0].map(tickFor)).toEqual([false, false, false, true, true, true, false]);
  });
});

describe("mute switch storage", () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
  };

  it("remembers the choice", () => {
    const s = memory();
    expect(readMuted(s)).toBe(false);
    writeMuted(s, true);
    expect(s.data.get(MUTE_KEY)).toBe("1");
    expect(readMuted(s)).toBe(true);
    writeMuted(s, false);
    expect(readMuted(s)).toBe(false);
  });

  it("survives blocked or missing storage", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readMuted(blocked)).toBe(false);
    expect(() => writeMuted(blocked, true)).not.toThrow();
    expect(readMuted(undefined)).toBe(false);
  });
});
