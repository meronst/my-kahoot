/**
 * lib/join-errors.ts — PIN validation and Hebrew messages for the join flow (KQ-8). Pure functions,
 * unit-tested in tests/unit/join.test.ts.
 *
 * join_session() raises short codes ('nickname_taken', ...) as the error message; anonymous sign-in
 * errors come from Supabase Auth with their own codes. Both are mapped here, never shown raw.
 */
import { t } from "@/strings/he";

/** Keeps digits only, so "123 456" or "123-456" typed on a phone still works. */
export function normalizePin(input: string): string {
  return input.replace(/\D/g, "");
}

export function isValidPin(pin: string): boolean {
  return /^[0-9]{6}$/.test(pin);
}

export function joinErrorMessage(error: { message?: string; code?: string; status?: number } | null | undefined): string {
  if (!error) return t.join.errors.generic;
  switch (error.message) {
    case "nickname_taken":
      return t.join.errors.nicknameTaken;
    case "nickname_invalid":
      return t.join.errors.nicknameInvalid;
    case "session_in_progress":
      return t.join.errors.inProgress;
    case "session_ended":
      return t.join.errors.ended;
    case "session_not_found":
      return t.join.errors.notFound;
  }
  // Supabase Auth: anonymous sign-ins are rate-limited per IP (a whole hall shares one Wi-Fi IP).
  if (error.code === "over_request_rate_limit" || error.status === 429) return t.join.errors.tooMany;
  return t.join.errors.generic;
}
