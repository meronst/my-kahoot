/**
 * lib/sound-plan.ts — WHEN the projector makes a sound (KQ-20). Pure and unit-tested;
 * lib/projector-audio.ts decides HOW it sounds.
 */
import type { SessionStatus } from "@/lib/game-types";

export type Effect = "question" | "tick" | "reveal" | "finale" | "join";

/** Background music plays while people are joining or chatting: the lobby and the pause between rounds. */
export function musicFor(status: SessionStatus): boolean {
  return status === "lobby" || status === "paused";
}

/** The sound for entering a new game state (nothing when the state didn't change, e.g. a re-sync). */
export function effectForTransition(prev: SessionStatus | null, next: SessionStatus): Effect | null {
  if (prev === null || prev === next) return null;
  switch (next) {
    case "question": return "question";
    case "reveal": return "reveal";
    case "finished": return "finale";
    default: return null;
  }
}

/** A soft tick for each of the last 5 seconds of a timed question. */
export function tickFor(secondsLeft: number | null): boolean {
  return secondsLeft !== null && secondsLeft >= 1 && secondsLeft <= 5;
}

// ── Mute switch, remembered in the browser (localStorage) ──────────────────────────────────────
// localStorage can be missing or throw (private mode, blocked storage): then we just don't remember.
export const MUTE_KEY = "my-kahoot:projector-muted";

export function readMuted(storage: Pick<Storage, "getItem"> | undefined): boolean {
  try {
    return storage?.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMuted(storage: Pick<Storage, "setItem"> | undefined, muted: boolean): void {
  try {
    storage?.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* not remembered; the toggle still works for this visit */
  }
}
