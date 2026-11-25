/**
 * tests/unit/auth.test.ts — the pure parts of host login: who counts as the host, and the
 * Hebrew error messages (KQ-6).
 */
import { describe, expect, it } from "vitest";
import { loginErrorMessage } from "@/lib/auth-errors";
import { isHostClaims } from "@/lib/host-claims";
import { t } from "@/strings/he";

describe("isHostClaims", () => {
  const host = { sub: "u1", email: "h@x.il", is_anonymous: false, app_metadata: { role: "host" } };

  it("accepts a non-anonymous user with app_metadata.role = host", () => {
    expect(isHostClaims(host)).toBe(true);
  });
  it("rejects a regular email account without the role", () => {
    expect(isHostClaims({ ...host, app_metadata: {} })).toBe(false);
  });
  it("rejects an anonymous player even if the role were somehow set", () => {
    expect(isHostClaims({ ...host, is_anonymous: true })).toBe(false);
  });
  it("rejects a role placed in user_metadata (editable by the user)", () => {
    expect(isHostClaims({ ...host, app_metadata: {}, user_metadata: { role: "host" } })).toBe(false);
  });
  it("rejects no session", () => {
    expect(isHostClaims(null)).toBe(false);
    expect(isHostClaims(undefined)).toBe(false);
  });
});

describe("loginErrorMessage", () => {
  it("wrong email or password → Hebrew 'incorrect' message", () => {
    expect(loginErrorMessage({ code: "invalid_credentials", status: 400 })).toBe(t.login.errors.invalidCredentials);
  });
  it("rate limited → 'too many attempts'", () => {
    expect(loginErrorMessage({ code: "over_request_rate_limit" })).toBe(t.login.errors.tooManyAttempts);
    expect(loginErrorMessage({ status: 429 })).toBe(t.login.errors.tooManyAttempts);
  });
  it("anything unknown → generic message, never the raw error", () => {
    expect(loginErrorMessage({ code: "something_new", status: 500 })).toBe(t.login.errors.generic);
  });
});
