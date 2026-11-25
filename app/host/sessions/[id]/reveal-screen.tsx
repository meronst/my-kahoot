/**
 * app/host/sessions/[id]/reveal-screen.tsx — the projector after a question closes.
 *
 * A bar per option (how many chose it), the correct option marked, the explanation, and the top 5
 * when the quiz is scored. Everything comes from sessions.reveal_payload, written by the database
 * at the reveal, so the projector and every phone see the same numbers.
 *
 * Bar heights are relative to the most-chosen option, so the chart stays readable with 3 players or 150.
 */
import { answerStyle } from "@/lib/answer-style";
import type { QuestionPayload, RevealPayload } from "@/lib/game-types";
import { t } from "@/strings/he";

export function RevealScreen({ question, reveal }: { question: QuestionPayload; reveal: RevealPayload }) {
  const max = Math.max(1, ...reveal.counts);

  return (
    <div className="flex w-full max-w-6xl flex-1 flex-col gap-6">
      <h1 className="text-center text-4xl font-bold leading-tight">{question.text}</h1>

      <ol data-testid="distribution" className="flex h-64 items-end justify-center gap-6">
        {question.options.map((text, i) => {
          const style = answerStyle(question.type, i);
          const correct = i === reveal.correct_idx;
          return (
            <li
              key={i}
              data-testid={`bar-${i}`}
              data-count={reveal.counts[i]}
              data-correct={correct}
              className={`flex w-40 flex-col items-center justify-end gap-2 ${correct ? "" : "opacity-50"}`}
            >
              <span className="text-3xl font-black">
                <bdi>{reveal.counts[i]}</bdi>
              </span>
              <div
                className={`${style.bg} w-full rounded-t-lg`}
                style={{ height: `${Math.max(6, (reveal.counts[i] / max) * 180)}px` }}
              />
              <span className="flex items-center gap-2 text-xl font-bold">
                <span aria-hidden>{style.symbol}</span>
                <span dir="auto">{text}</span>
                {correct && <span aria-label={t.projector.correctAnswer}>✔</span>}
              </span>
            </li>
          );
        })}
      </ol>

      <p data-testid="correct-answer" className="text-center text-3xl">
        {t.projector.correctAnswer}: <strong dir="auto">{question.options[reveal.correct_idx]}</strong>
      </p>
      {reveal.explanation && (
        <p data-testid="explanation" className="mx-auto max-w-4xl text-center text-2xl opacity-90">
          {reveal.explanation}
        </p>
      )}

      {reveal.show_scores && reveal.leaderboard.length > 0 && (
        <section className="mx-auto w-full max-w-xl">
          <h2 className="mb-2 text-center text-2xl font-bold">{t.projector.leaderboard}</h2>
          <ol data-testid="leaderboard" className="flex flex-col gap-2">
            {reveal.leaderboard.map((row, i) => (
              <li key={row.player_id} className="flex items-center justify-between rounded-lg bg-current/10 px-4 py-2 text-2xl">
                <span>
                  <bdi>{i + 1}</bdi>. <bdi dir="auto">{row.nickname}</bdi>
                </span>
                <bdi>{row.score}</bdi>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
