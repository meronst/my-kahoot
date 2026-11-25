/**
 * lib/phones-csv.ts — builds the phone-number export file (KQ-19). Pure, unit-tested.
 *
 * - UTF-8 with a BOM (byte-order mark) first: without it, Excel opens Hebrew as gibberish.
 * - Dates as dd/MM/yyyy in Israel time.
 * - Formula injection guard: a nickname like "=HYPERLINK(...)" would run as a formula when the file
 *   is opened in Excel. Cells starting with = + - @ get a leading apostrophe, which Excel shows as text.
 */
import { t } from "@/strings/he";

export type PhoneRow = { nickname: string; phone: string; phone_consent_at: string | null };

const dateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "numeric" });

function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function phonesCsv(rows: PhoneRow[]): string {
  const lines = [
    [t.phones.nickname, t.phones.phone, t.phones.consentDate],
    ...rows.map((r) => [r.nickname, r.phone, r.phone_consent_at ? dateFormat.format(new Date(r.phone_consent_at)) : ""]),
  ];
  return "﻿" + lines.map((line) => line.map(cell).join(",")).join("\r\n") + "\r\n";
}
