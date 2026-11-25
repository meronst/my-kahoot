/**
 * lib/read-sheet.ts — reads an uploaded .xlsx or .csv file into rows of cells, in the browser (KQ-18).
 *
 * .xlsx: read-excel-file (small, reads only — we never need to write Excel in the app).
 * .csv:  papaparse. Excel in Hebrew saves "CSV" in the old Windows-1255 encoding unless you pick
 *        "CSV UTF-8", so we try UTF-8 first and fall back to Windows-1255 if the bytes aren't valid UTF-8.
 * The libraries are loaded only when a file is picked (dynamic import), so the editor page stays light.
 */
import type { Cell } from "@/lib/quiz-import";

export function decodeCsvBytes(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1255").decode(bytes);
  }
}

export async function readSheetFile(file: File): Promise<Cell[][]> {
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    const Papa = (await import("papaparse")).default;
    return Papa.parse<string[]>(decodeCsvBytes(await file.arrayBuffer()), { skipEmptyLines: false }).data;
  }
  const { readSheet } = await import("read-excel-file/universal");
  return (await readSheet(file)) as Cell[][];
}
