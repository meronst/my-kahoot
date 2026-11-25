/**
 * lib/auth-errors.ts — turns Supabase login errors into short Hebrew messages for the login form.
 *
 * Supabase errors carry a machine-readable `code` (e.g. "invalid_credentials"). We map codes, not
 * English message texts, because codes are stable while wording can change between versions.
 * Unknown errors get a generic message: never show raw technical errors to the user.
 */
import { t } from "@/strings/he";

export function loginErrorMessage(error: { code?: string; status?: number } | null | undefined): string {
  if (!error) return t.login.errors.generic;
  switch (error.code) {
    case "invalid_credentials":
      return t.login.errors.invalidCredentials;
    case "email_not_confirmed":
      return t.login.errors.emailNotConfirmed;
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return t.login.errors.tooManyAttempts;
    default:
      return error.status === 429 ? t.login.errors.tooManyAttempts : t.login.errors.generic;
  }
}
