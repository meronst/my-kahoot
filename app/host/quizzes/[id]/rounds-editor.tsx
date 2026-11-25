/**
 * app/host/quizzes/[id]/rounds-editor.tsx — the list of rounds and their questions (KQ-16).
 *
 * A Server Component: it only renders. Every button here is a tiny <form> whose action is a Server
 * Action with its arguments pre-filled by .bind() — e.g. moveRound.bind(null, round.id, -1) is like
 * a Java lambda `() -> moveRound(roundId, -1)`. Forms work even before the page's JavaScript loads.
 *
 * Reordering uses ▲/▼ buttons rather than drag-and-drop: they work the same with a mouse, a touch
 * screen and a keyboard, and need no extra library.
 */
import { ConfirmButton } from "@/components/confirm-button";
import { t } from "@/strings/he";
import {
  addQuestion,
  addRound,
  deleteQuestion,
  deleteRound,
  moveQuestion,
  moveRound,
  renameRound,
} from "./actions";
import { QuestionEditor, type EditableQuestion } from "./question-editor";

export type EditableRound = { id: string; title: string | null; questions: EditableQuestion[] };

const smallButton = "rounded-md border border-current/30 px-2 py-1 text-sm disabled:opacity-30";

function MoveButtons({ up, down, first, last }: { up: () => Promise<void>; down: () => Promise<void>; first: boolean; last: boolean }) {
  return (
    <div className="flex gap-1">
      <form action={up}>
        <button type="submit" disabled={first} aria-label={t.editor.moveUp} title={t.editor.moveUp} data-testid="move-up" className={smallButton}>▲</button>
      </form>
      <form action={down}>
        <button type="submit" disabled={last} aria-label={t.editor.moveDown} title={t.editor.moveDown} data-testid="move-down" className={smallButton}>▼</button>
      </form>
    </div>
  );
}

export function RoundsEditor({ quizId, rounds }: { quizId: string; rounds: EditableRound[] }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">{t.editor.rounds}</h2>
      {rounds.length === 0 && <p className="opacity-70">{t.editor.noRounds}</p>}

      {rounds.map((round, ri) => (
        <div key={round.id} data-testid="round" className="flex flex-col gap-3 rounded-lg border border-current/20 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{t.editor.round} <bdi>{ri + 1}</bdi></span>
            {/* key: when the saved title changes, React re-creates the input with the new default */}
            <form key={round.title ?? ""} action={renameRound.bind(null, round.id)} className="flex flex-1 gap-2">
              <input
                name="title"
                defaultValue={round.title ?? ""}
                placeholder={t.editor.roundTitle}
                aria-label={t.editor.roundTitle}
                maxLength={80}
                dir="auto"
                data-testid="round-title"
                className="min-w-0 flex-1 rounded-md border border-current/30 bg-transparent px-2 py-1"
              />
              <button type="submit" data-testid="round-title-save" className={smallButton}>{t.editor.saveTitle}</button>
            </form>
            <MoveButtons
              up={moveRound.bind(null, round.id, -1)}
              down={moveRound.bind(null, round.id, 1)}
              first={ri === 0}
              last={ri === rounds.length - 1}
            />
            <ConfirmButton
              label={t.editor.deleteRound}
              confirmLabel={t.editor.deleteRoundConfirm}
              action={deleteRound.bind(null, round.id)}
              testId="round-delete"
              className={smallButton}
            />
          </div>

          {round.questions.length === 0 && <p className="opacity-70">{t.editor.noQuestions}</p>}
          <ol className="flex flex-col gap-2">
            {round.questions.map((q, qi) => (
              <li key={q.id} data-testid="question" className="flex flex-col gap-2 rounded-md border border-current/10 p-2">
                <QuestionEditor quizId={quizId} question={q} number={qi + 1}>
                  <MoveButtons
                    up={moveQuestion.bind(null, q.id, -1)}
                    down={moveQuestion.bind(null, q.id, 1)}
                    first={qi === 0}
                    last={qi === round.questions.length - 1}
                  />
                  <ConfirmButton
                    label={t.editor.delete}
                    confirmLabel={t.editor.deleteConfirm}
                    action={deleteQuestion.bind(null, q.id)}
                    testId="question-delete"
                    className={smallButton}
                  />
                </QuestionEditor>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-2">
            <form action={addQuestion.bind(null, round.id, "mc")}>
              <button type="submit" data-testid="add-mc" className={smallButton}>+ {t.editor.addMc}</button>
            </form>
            <form action={addQuestion.bind(null, round.id, "tf")}>
              <button type="submit" data-testid="add-tf" className={smallButton}>+ {t.editor.addTf}</button>
            </form>
          </div>
        </div>
      ))}

      <form action={addRound.bind(null, quizId)}>
        <button type="submit" data-testid="add-round" className="rounded-md bg-blue-600 px-4 py-2 font-bold text-white">
          + {t.editor.addRound}
        </button>
      </form>
    </section>
  );
}
