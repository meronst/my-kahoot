/**
 * lib/game-types.ts — TypeScript shapes of the JSON the game engine writes into `sessions`
 * (see supabase/migrations/*_game_engine.sql: _show_question and reveal_question).
 *
 * The generated DB types only know these columns as `Json` (any JSON). Describing their real shape
 * here lets the screens use them safely. If the SQL changes the payload, change it here too.
 */
import type { Database } from "@/lib/database.types";

export type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
export type SessionStatus = Database["public"]["Enums"]["session_status"];

/** What everyone (including phones) may see during a question: no answer key, no explanation. */
export type QuestionPayload = {
  question_id: string;
  round_idx: number;
  round_count: number;
  question_idx: number;
  round_size: number;
  type: "mc" | "tf";
  text: string;
  image_path: string | null;
  time_limit_sec: number | null;
  options: string[];
};

/** Published at the reveal. `results` is keyed by player id. */
export type RevealPayload = {
  question_id: string;
  correct_idx: number;
  explanation: string | null;
  counts: number[];
  answered: number;
  players: number;
  show_scores: boolean;
  leaderboard: { player_id: string; nickname: string; score: number }[];
  results: Record<string, { score: number; points: number; correct: boolean | null }>;
};

export function questionPayload(session: Pick<SessionRow, "question_payload">): QuestionPayload | null {
  return (session.question_payload as QuestionPayload | null) ?? null;
}

export function revealPayload(session: Pick<SessionRow, "reveal_payload">): RevealPayload | null {
  return (session.reveal_payload as RevealPayload | null) ?? null;
}

/**
 * A number that only grows as the game moves forward through the state machine:
 *   lobby < question(r,q) < reveal(r,q) < question(r,q+1) … < paused(before round r+1)
 *   < question(r+1,0) … < finished.
 * Live screens get the same row from several sources (host action reply, Realtime event, poll);
 * accepting a row only if its key is >= the current one means a late, older reply can never
 * send the screen backwards.
 */
export function progressKey(s: Pick<SessionRow, "status" | "round_idx" | "question_idx">): number {
  const position = s.round_idx * 10_000 + s.question_idx * 10;
  switch (s.status) {
    case "lobby":
      return -1;
    case "paused":
      return s.round_idx * 10_000; // just before question 0 of the round it will resume with
    case "question":
      return position + 1;
    case "reveal":
      return position + 2;
    case "finished":
      return Number.MAX_SAFE_INTEGER;
  }
}
