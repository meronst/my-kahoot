/**
 * tests/unit/phone.test.ts — phone number format and the CSV export (KQ-19).
 */
import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/phone";
import { phonesCsv } from "@/lib/phones-csv";
import { joinErrorMessage } from "@/lib/join-errors";
import { t } from "@/strings/he";

describe("normalizePhone", () => {
  it("accepts Israeli mobile numbers in the usual ways of writing them", () => {
    for (const input of ["0501234567", "050-1234567", "050 123 4567", "+972 50-123-4567", "972501234567", "(050) 123.4567"]) {
      expect(normalizePhone(input), input).toBe("0501234567");
    }
  });
  it("rejects landlines, short numbers and text", () => {
    for (const input of ["031234567", "05012345", "05012345678", "abc", "", "+1 202 555 0100"]) {
      expect(normalizePhone(input), input).toBeNull();
    }
  });
  it("maps the database error to Hebrew", () => {
    expect(joinErrorMessage({ message: "phone_invalid" })).toBe(t.join.errors.phoneInvalid);
  });
});

describe("phonesCsv", () => {
  it("writes a BOM, Hebrew titles and Israeli dates", () => {
    const csv = phonesCsv([{ nickname: "דנה", phone: "0501234567", phone_consent_at: "2026-11-25T22:30:00Z" }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      `${t.phones.nickname},${t.phones.phone},${t.phones.consentDate}`,
      "דנה,0501234567,26/11/2026", // 22:30 UTC is already the 26th in Israel
      "",
    ]);
  });
  it("quotes commas and quotes, and defuses spreadsheet formulas in nicknames", () => {
    const csv = phonesCsv([
      { nickname: 'אבי, "המלך"', phone: "0501111111", phone_consent_at: null },
      { nickname: "=HYPERLINK(1)", phone: "0502222222", phone_consent_at: null },
    ]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1]).toBe('"אבי, ""המלך""",0501111111,');
    expect(lines[2]).toBe("'=HYPERLINK(1),0502222222,");
  });
});
