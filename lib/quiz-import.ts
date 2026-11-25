/**
 * lib/quiz-import.ts — turns the rows of an imported spreadsheet into rounds and questions (KQ-18).
 * Pure, unit-tested; runs in the browser (for the preview) and again on the server (before saving),
 * because the server never trusts what the browser sends.
 *
 * Input: a "2D array" — rows of cells, the first row being the column titles (in Hebrew, as in the
 * template; English names also work). Each later row is one question. Rows with the same round
 * number form one round; rounds are ordered by number, questions by their order in the file.
 *
 * All-or-nothing: if any row is wrong, the result lists EVERY problem with its row number (as Excel
 * shows it: the title row is 1) and nothing is imported.
 *
 * Each row is checked by the same parseQuestionForm the editor uses, so an imported question obeys
 * exactly the same rules as a typed one.
 */
import { parseQuestionForm, TF_OPTIONS, TIMER_CHOICES, type QuestionInput } from "@/lib/question-form";
import { t } from "@/strings/he";

export type Cell = string | number | boolean | Date | null | undefined;
export type ImportedRound = { number: number; title: string | null; questions: QuestionInput[] };
export type ImportError = { row: number; message: string };
export type ImportResult = { ok: true; rounds: ImportedRound[] } | { ok: false; errors: ImportError[] };

export const MAX_IMPORT_ROWS = 500;
const c = t.import.columns;

/** Column → accepted titles (compared without spaces and case). */
const COLUMNS = {
  round: [c.round, "round"],
  roundTitle: [c.roundTitle, "round_title"],
  question: [c.question, "question"],
  type: [c.type, "type"],
  option1: [`${c.option} 1`, "option1"],
  option2: [`${c.option} 2`, "option2"],
  option3: [`${c.option} 3`, "option3"],
  option4: [`${c.option} 4`, "option4"],
  correct: [c.correct, "correct"],
  time: [c.time, "time_sec"],
  explanation: [c.explanation, "explanation"],
} as const;
type Column = keyof typeof COLUMNS;
const REQUIRED: Column[] = ["round", "question", "type", "option1", "option2", "correct"];

/** The template's title row, in order (also used to build the downloadable template). */
export const TEMPLATE_HEADERS = (Object.keys(COLUMNS) as Column[]).map((k) => COLUMNS[k][0]);

const squash = (s: string) => s.replace(/\s+/g, "").toLowerCase();

export function cellText(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function parseType(raw: string): "mc" | "tf" | null {
  const v = squash(raw);
  if (["mc", squash(t.editor.types.mc)].includes(v)) return "mc";
  if (["tf", squash(t.editor.types.tf), "נכוןלאנכון", "נכון-לאנכון"].includes(v)) return "tf";
  return null;
}

/** The correct answer as an option index (0-based), or null if it doesn't make sense for the type. */
function parseCorrect(raw: string, type: "mc" | "tf"): number | null {
  const v = squash(raw);
  if (type === "tf") {
    if ([squash(TF_OPTIONS[0]), "true", "1"].includes(v)) return 0;
    if ([squash(TF_OPTIONS[1]), "false", "2"].includes(v)) return 1;
    return null;
  }
  return /^[1-4]$/.test(v) ? Number(v) - 1 : null;
}

export function parseImportRows(rows: Cell[][]): ImportResult {
  const [header, ...body] = rows;
  if (!header) return { ok: false, errors: [{ row: 1, message: t.import.errors.empty }] };

  // Where is each column? (Users may reorder or drop the optional ones.)
  const titles = header.map((h) => squash(cellText(h)));
  const index = {} as Record<Column, number>;
  for (const key of Object.keys(COLUMNS) as Column[]) {
    index[key] = titles.findIndex((title) => COLUMNS[key].some((name) => squash(name) === title));
  }
  const missing = REQUIRED.filter((key) => index[key] === -1);
  if (missing.length) {
    return {
      ok: false,
      errors: [{ row: 1, message: `${t.import.errors.missingColumn} ${missing.map((k) => COLUMNS[k][0]).join(", ")}` }],
    };
  }

  const get = (row: Cell[], key: Column) => (index[key] === -1 ? "" : cellText(row[index[key]]));
  const filled = body
    .map((cells, i) => ({ cells, row: i + 2 })) // +2: Excel counts from 1, and row 1 is the titles
    .filter(({ cells }) => cells.some((cell) => cellText(cell) !== ""));
  if (filled.length === 0) return { ok: false, errors: [{ row: 2, message: t.import.errors.empty }] };
  if (filled.length > MAX_IMPORT_ROWS) return { ok: false, errors: [{ row: MAX_IMPORT_ROWS + 2, message: t.import.errors.tooMany }] };

  const errors: ImportError[] = [];
  const rounds = new Map<number, ImportedRound>();

  for (const { cells, row } of filled) {
    const fail = (message: string) => errors.push({ row, message });

    const roundRaw = get(cells, "round");
    if (!/^\d+$/.test(roundRaw) || Number(roundRaw) < 1) { fail(t.import.errors.round); continue; }

    const type = parseType(get(cells, "type"));
    if (!type) { fail(t.import.errors.type); continue; }

    const correct = parseCorrect(get(cells, "correct"), type);
    if (correct === null) { fail(type === "tf" ? t.import.errors.correctTf : t.import.errors.correctMc); continue; }

    const time = get(cells, "time");
    if (time !== "" && !(TIMER_CHOICES as readonly number[]).includes(Number(time))) { fail(t.import.errors.time); continue; }

    // Same checks as the editor: build the editor's form and let parseQuestionForm decide.
    const form = new FormData();
    form.set("type", type);
    form.set("text", get(cells, "question"));
    (["option1", "option2", "option3", "option4"] as const).forEach((key, i) => form.set(`option_${i}`, get(cells, key)));
    form.set("correct", String(correct));
    form.set("time_limit", time);
    form.set("explanation", get(cells, "explanation"));
    const parsed = parseQuestionForm(form);
    if (!parsed.ok) { fail(parsed.error); continue; }

    const number = Number(roundRaw);
    const round = rounds.get(number) ?? { number, title: null, questions: [] };
    round.title ??= get(cells, "roundTitle").slice(0, 80) || null;
    round.questions.push(parsed.value);
    rounds.set(number, round);
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, rounds: [...rounds.values()].sort((a, b) => a.number - b.number) };
}
