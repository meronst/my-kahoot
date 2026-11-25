/**
 * lib/scoring.ts — the scoring formula in TypeScript.
 *
 * The database computes the real score (public.score_answer in the game_engine migration); this copy
 * exists for unit tests and for explaining points in the UI. An integration test
 * (tests/integration/game-engine.test.ts) checks that both give the same numbers, so they can't drift.
 *
 *   speed:   correct → 1000 × (1 − 0.5 × elapsed/limit): 1000 instantly, 500 at the last moment;
 *            no timer → 1000
 *   points:  correct → 1000
 *   results: always 0 (no scores in this mode)
 *   wrong:   0 in every mode
 */
export type ScoringMode = "speed" | "points" | "results";

export function scoreAnswer(
  mode: ScoringMode,
  correct: boolean,
  elapsedMs: number,
  limitSec: number | null,
): number {
  if (!correct || mode === "results") return 0;
  if (mode === "points" || limitSec === null) return 1000;
  const limitMs = limitSec * 1000;
  const clamped = Math.min(Math.max(elapsedMs, 0), limitMs);
  // Postgres round() rounds halves away from zero; Math.round rounds them up. Points are never
  // negative here, so both agree.
  return Math.round(1000 * (1 - (0.5 * clamped) / limitMs));
}
