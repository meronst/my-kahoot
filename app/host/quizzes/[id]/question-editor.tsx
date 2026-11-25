/**
 * app/host/quizzes/[id]/question-editor.tsx — one question: a summary line that opens into a form.
 *
 * A Client Component because it has state (open/closed) and uses useActionState for the save result.
 * `children` are the move/delete buttons rendered by the server parent: a Client Component can show
 * server-rendered pieces passed in as props (like passing an already-built widget into a constructor).
 *
 * The form keeps the inputs uncontrolled (defaultValue): the browser holds what is being typed, and
 * the FormData sent on submit is read by parseQuestionForm on the server. After a save, refresh()
 * re-renders the page with the saved data; the `key` below makes React rebuild the form from it.
 */
"use client";

import { useActionState, useState, type ReactNode } from "react";
import { TF_OPTIONS, TIMER_CHOICES } from "@/lib/question-form";
import { t } from "@/strings/he";
import { saveQuestion, type QuestionSaveState } from "./actions";

export type EditableQuestion = {
  id: string;
  type: "mc" | "tf";
  text: string;
  options: { text: string; correct: boolean }[];
  time_limit_sec: number | null;
  explanation: string | null;
};

const input = "rounded-md border border-current/30 bg-transparent px-2 py-1";

export function QuestionEditor({ question, number, children }: { question: EditableQuestion; number: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<QuestionSaveState, FormData>(
    saveQuestion.bind(null, question.id),
    {},
  );
  const correctIndex = question.options.findIndex((o) => o.correct);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold"><bdi>{number}</bdi>.</span>
        <span dir="auto" data-testid="question-text" className="min-w-0 flex-1 truncate">{question.text}</span>
        <span className="text-sm opacity-70">{t.editor.types[question.type]}</span>
        <button type="button" data-testid="question-edit" onClick={() => setOpen(!open)} className="rounded-md border border-current/30 px-2 py-1 text-sm">
          {open ? t.editor.cancel : t.editor.edit}
        </button>
        {children}
      </div>

      {open && (
        <form key={JSON.stringify(question)} action={action} data-testid="question-form" className="flex flex-col gap-3">
          <input type="hidden" name="type" value={question.type} />
          <label className="flex flex-col gap-1">
            <span>{t.editor.question}</span>
            <textarea name="text" defaultValue={question.text} required maxLength={300} rows={2} dir="auto" className={input} />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1">{t.editor.options}</legend>
            {question.type === "tf"
              ? TF_OPTIONS.map((label, i) => (
                  <label key={label} className="flex items-center gap-2">
                    <input type="radio" name="correct" value={i} defaultChecked={i === correctIndex} />
                    <span>{label}</span>
                  </label>
                ))
              : [0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="radio" name="correct" value={i} defaultChecked={i === correctIndex} aria-label={`${t.editor.correct} ${i + 1}`} />
                    <input
                      name={`option_${i}`}
                      defaultValue={question.options[i]?.text ?? ""}
                      placeholder={`${t.editor.optionPlaceholder} ${i + 1}`}
                      maxLength={100}
                      dir="auto"
                      data-testid={`option-${i}`}
                      className={`${input} flex-1`}
                    />
                  </div>
                ))}
          </fieldset>

          <label className="flex items-center gap-2">
            <span>{t.editor.timer}</span>
            <select name="time_limit" defaultValue={question.time_limit_sec ?? ""} data-testid="time-limit" className={input}>
              <option value="">{t.editor.noTimer}</option>
              {TIMER_CHOICES.map((s) => (
                <option key={s} value={s}>{s} {t.editor.seconds}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span>{t.editor.explanation}</span>
            <textarea name="explanation" defaultValue={question.explanation ?? ""} maxLength={500} rows={2} dir="auto" className={input} />
          </label>

          <div className="flex items-center gap-4">
            <button type="submit" disabled={pending} data-testid="question-save" className="rounded-md bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-60">
              {pending ? t.editor.saving : t.editor.save}
            </button>
            {state.saved && !pending && <span data-testid="question-saved" className="text-green-700 dark:text-green-400">{t.editor.saved}</span>}
            {state.error && <span role="alert" data-testid="question-error" className="text-red-600 dark:text-red-400">{state.error}</span>}
          </div>
        </form>
      )}
    </>
  );
}
