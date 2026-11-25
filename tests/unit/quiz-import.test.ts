/**
 * tests/unit/quiz-import.test.ts — reading imported spreadsheets (KQ-18).
 * Acceptance criteria: a valid template imports correctly; a broken row shows its row number and
 * reason, and nothing is imported.
 */
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/node";
import { describe, expect, it } from "vitest";
import { parseImportRows, TEMPLATE_HEADERS, type Cell } from "@/lib/quiz-import";
import { decodeCsvBytes } from "@/lib/read-sheet";
import { t } from "@/strings/he";

const H = TEMPLATE_HEADERS;
const row = (o: Partial<Record<string, string>>) => H.map((h) => o[h] ?? "");
/** A copy of `cells` with column i changed. */
const set = (cells: string[], i: number, value: string) => cells.map((c, j) => (j === i ? value : c));
const mc = (round: string, text: string) =>
  row({ [H[0]]: round, [H[2]]: text, [H[3]]: "אמריקאית", [H[4]]: "א", [H[5]]: "ב", [H[8]]: "1" });

function expectTemplate(rows: Cell[][]) {
  const result = parseImportRows(rows);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.rounds.map((r) => [r.number, r.title, r.questions.length])).toEqual([[1, "פתיחה", 2], [2, "סבב שני", 1]]);
  expect(result.rounds[0].questions[0]).toEqual({
    type: "mc",
    text: "איזו עיר היא בירת ישראל?",
    options: [
      { text: "תל אביב", correct: false }, { text: "ירושלים", correct: true },
      { text: "חיפה", correct: false }, { text: "באר שבע", correct: false },
    ],
    time_limit_sec: 20,
    explanation: "ירושלים היא בירת ישראל.",
  });
  expect(result.rounds[0].questions[1]).toMatchObject({
    type: "tf", options: [{ text: "נכון", correct: true }, { text: "לא נכון", correct: false }], time_limit_sec: 15, explanation: null,
  });
  // Numbers typed into cells ("3", "5", "7") come back as text options.
  expect(result.rounds[1].questions[0]).toMatchObject({ options: [{ text: "3" }, { text: "5", correct: true }, { text: "7" }], time_limit_sec: null });
}

describe("the downloadable templates", () => {
  it("the Excel template imports correctly", async () => {
    const rows = await readSheet(readFileSync("public/templates/quiz-template.xlsx"));
    expect(rows[0]).toEqual(H);
    expectTemplate(rows as Cell[][]);
  });
  it("the CSV template imports correctly", () => {
    const file = readFileSync("public/templates/quiz-template.csv");
    const text = decodeCsvBytes(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);
    expectTemplate(Papa.parse<string[]>(text).data);
  });
});

describe("parseImportRows", () => {
  it("groups by round number (sorted), keeps file order inside a round, skips empty rows", () => {
    const r = parseImportRows([H, mc("2", "ב1"), [], mc("1", "א1"), H.map(() => " "), mc("2", "ב2")]);
    expect(r.ok && r.rounds.map((x) => [x.number, x.questions.map((q) => q.text)])).toEqual([[1, ["א1"]], [2, ["ב1", "ב2"]]]);
  });

  it("accepts English titles and columns in any order", () => {
    const r = parseImportRows([
      ["question", "type", "round", "correct", "option2", "option1"],
      ["Capital?", "tf", "1", "false", "", ""],
    ]);
    expect(r).toMatchObject({ ok: true, rounds: [{ questions: [{ type: "tf", options: [{ correct: false }, { correct: true }] }] }] });
  });

  it("lists every broken row with its Excel row number, and imports nothing", () => {
    const r = parseImportRows([
      H,
      mc("1", "תקינה"),                                       // row 2: fine
      set(mc("x", "ש"), 0, "x"),      // row 3: bad round
      row({ [H[0]]: "1", [H[2]]: "ש", [H[3]]: "חיבור", [H[8]]: "1" }), // row 4: unknown type
      set(mc("1", "ש"), 8, "5"),      // row 5: correct out of range
      row({ [H[0]]: "1", [H[2]]: "ש", [H[3]]: "נכון/לא נכון", [H[8]]: "אולי" }), // row 6
      set(mc("1", "ש"), 9, "7"),      // row 7: bad time
      mc("1", ""),              // row 8: no question text
      set(mc("1", "ש"), 5, "א"),      // row 9: duplicate options
    ]);
    expect(r).toEqual({
      ok: false,
      errors: [
        { row: 3, message: t.import.errors.round },
        { row: 4, message: t.import.errors.type },
        { row: 5, message: t.import.errors.correctMc },
        { row: 6, message: t.import.errors.correctTf },
        { row: 7, message: t.import.errors.time },
        { row: 8, message: t.editor.errors.textRequired },
        { row: 9, message: t.editor.errors.duplicateOptions },
      ],
    });
  });

  it("explains a missing column and an empty file", () => {
    const noType = parseImportRows([H.filter((h) => h !== "סוג"), ["1"]]);
    expect(noType).toEqual({ ok: false, errors: [{ row: 1, message: `${t.import.errors.missingColumn} סוג` }] });
    expect(parseImportRows([])).toEqual({ ok: false, errors: [{ row: 1, message: t.import.errors.empty }] });
    expect(parseImportRows([H, ["", ""]])).toEqual({ ok: false, errors: [{ row: 2, message: t.import.errors.empty }] });
  });

  it("refuses more than 500 questions", () => {
    const r = parseImportRows([H, ...Array.from({ length: 501 }, (_, i) => mc("1", `ש${i}`))]);
    expect(r.ok).toBe(false);
  });
});

describe("decodeCsvBytes", () => {
  it("reads UTF-8 with BOM and old Hebrew Excel (Windows-1255) files", () => {
    const utf8 = new TextEncoder().encode("﻿שאלה");
    expect(decodeCsvBytes(utf8.buffer as ArrayBuffer)).toBe("שאלה");
    const win1255 = new Uint8Array([0xf9, 0xe0, 0xec, 0xe4]); // "שאלה" in Windows-1255
    expect(decodeCsvBytes(win1255.buffer)).toBe("שאלה");
  });
});
