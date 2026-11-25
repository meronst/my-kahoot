/**
 * app/host/quizzes/[id]/import-panel.tsx — import questions from Excel/CSV (KQ-18).
 *
 * Flow: pick a file → the browser reads and checks it (parseImportRows) → either a list of problems
 * with row numbers, or a preview → "import" sends the raw rows to the server, which checks them again
 * and saves everything in one transaction. Nothing is saved until the host confirms the preview.
 */
"use client";

import { useState, useTransition } from "react";
import { parseImportRows, type Cell, type ImportError, type ImportedRound } from "@/lib/quiz-import";
import { readSheetFile } from "@/lib/read-sheet";
import { t } from "@/strings/he";
import { importRows } from "./actions";

type View =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "errors"; errors: ImportError[] }
  | { kind: "preview"; rows: Cell[][]; rounds: ImportedRound[] }
  | { kind: "done"; count: number };

const button = "rounded-md border border-current/30 px-3 py-1";

export function ImportPanel({ quizId }: { quizId: string }) {
  const [view, setView] = useState<View>({ kind: "idle" });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setSaveError(null);
    setView({ kind: "reading" });
    let rows: Cell[][];
    try {
      rows = await readSheetFile(file);
    } catch {
      setView({ kind: "errors", errors: [{ row: 1, message: t.import.errors.badFile }] });
      return;
    }
    const result = parseImportRows(rows);
    setView(result.ok ? { kind: "preview", rows, rounds: result.rounds } : { kind: "errors", errors: result.errors });
  }

  function confirm(rows: Cell[][]) {
    startSaving(async () => {
      const result = await importRows(quizId, rows);
      if (result.errors) setView({ kind: "errors", errors: result.errors });
      else if (result.error) setSaveError(result.error);
      else setView({ kind: "done", count: result.imported ?? 0 });
    });
  }

  return (
    <section data-testid="import-panel" className="flex flex-col gap-3 rounded-lg border border-current/20 p-4">
      <h2 className="text-xl font-bold">{t.import.title}</h2>
      <p className="opacity-80">{t.import.hint}</p>
      <div className="flex flex-wrap items-center gap-3">
        <a href="/templates/quiz-template.xlsx" download className="underline">{t.import.templateXlsx}</a>
        <a href="/templates/quiz-template.csv" download className="underline">{t.import.templateCsv}</a>
        <label className={`${button} cursor-pointer`}>
          {t.import.chooseFile}
          <input
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            data-testid="import-file"
            className="sr-only"
            onChange={(e) => {
              void onFile(e.currentTarget.files?.[0]);
              e.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      {view.kind === "reading" && <p>{t.import.reading}</p>}

      {view.kind === "errors" && (
        <div role="alert" data-testid="import-errors" className="flex flex-col gap-1 text-red-700 dark:text-red-400">
          <p className="font-bold">{t.import.errorsTitle}</p>
          <ul className="list-disc ps-6">
            {view.errors.map((e, i) => (
              <li key={i} data-testid="import-error">
                {t.import.row} <bdi>{e.row}</bdi>: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {view.kind === "preview" && (
        <div data-testid="import-preview" className="flex flex-col gap-3">
          <h3 className="font-bold">
            {t.import.previewTitle}: <bdi data-testid="import-round-count">{view.rounds.length}</bdi> {t.import.rounds},{" "}
            <bdi data-testid="import-question-count">{view.rounds.reduce((n, r) => n + r.questions.length, 0)}</bdi> {t.import.questions}
          </h3>
          {view.rounds.map((round) => (
            <div key={round.number} className="flex flex-col gap-1">
              <span className="font-bold">
                {t.editor.round} <bdi>{round.number}</bdi>{round.title && <> · <bdi>{round.title}</bdi></>}
              </span>
              <ol className="list-decimal ps-6">
                {round.questions.map((q, i) => (
                  <li key={i}>
                    <bdi>{q.text}</bdi> <span className="opacity-70">({t.editor.types[q.type]})</span>
                    {" — "}
                    {q.options.map((o, oi) => (
                      <span key={oi} className={o.correct ? "font-bold text-green-700 dark:text-green-400" : "opacity-80"}>
                        {oi > 0 && " / "}
                        <bdi>{o.text}</bdi>
                        {o.correct && " ✓"}
                      </span>
                    ))}
                    <span className="opacity-70">
                      {" · "}
                      {q.time_limit_sec === null ? t.import.noTimer : <><bdi>{q.time_limit_sec}</bdi> {t.editor.seconds}</>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button type="button" data-testid="import-confirm" disabled={saving} onClick={() => confirm(view.rows)} className="rounded-md bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-60">
              {saving ? t.import.importing : t.import.confirm}
            </button>
            <button type="button" disabled={saving} onClick={() => setView({ kind: "idle" })} className={button}>{t.import.cancel}</button>
            {saveError && <span role="alert" className="text-red-600 dark:text-red-400">{saveError}</span>}
          </div>
        </div>
      )}

      {view.kind === "done" && (
        <p data-testid="import-done" className="text-green-700 dark:text-green-400">
          {t.import.done}: <bdi>{view.count}</bdi> {t.import.questions}
        </p>
      )}
    </section>
  );
}
