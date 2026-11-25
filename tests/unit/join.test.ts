/**
 * tests/unit/join.test.ts — PIN parsing and join error messages (KQ-8).
 */
import { describe, expect, it } from "vitest";
import { isValidPin, joinErrorMessage, normalizePin } from "@/lib/join-errors";
import { t } from "@/strings/he";

describe("PIN input", () => {
  it("keeps digits only", () => {
    expect(normalizePin(" 123-456 ")).toBe("123456");
    expect(normalizePin("12 34 56")).toBe("123456");
  });
  it("accepts exactly 6 digits", () => {
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("1234567")).toBe(false);
    expect(isValidPin("12a456")).toBe(false);
  });
});

describe("joinErrorMessage", () => {
  it("maps database error codes to Hebrew", () => {
    expect(joinErrorMessage({ message: "nickname_taken" })).toBe(t.join.errors.nicknameTaken);
    expect(joinErrorMessage({ message: "session_in_progress" })).toBe(t.join.errors.inProgress);
    expect(joinErrorMessage({ message: "session_ended" })).toBe(t.join.errors.ended);
  });
  it("maps the anonymous sign-in rate limit", () => {
    expect(joinErrorMessage({ code: "over_request_rate_limit", status: 429 })).toBe(t.join.errors.tooMany);
  });
  it("never shows raw errors", () => {
    expect(joinErrorMessage({ message: "relation does not exist" })).toBe(t.join.errors.generic);
  });
});
