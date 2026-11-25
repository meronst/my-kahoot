/**
 * app/play/[sessionId]/player-game.tsx — everything the phone shows during a game (KQ-8 + KQ-11).
 *
 *   lobby    → "waiting for the host"
 *   question → the full question + big answer buttons + countdown; after one tap: "answer received"
 *   reveal   → correct / wrong, points for this question, total score
 *   paused   → break message + score
 *   finished → end message + score (final rank comes with KQ-14)
 *
 * Follows the session with useLiveSession({ poll: false }): Realtime plus a re-read when the phone
 * comes back to the foreground (no polling from 150 phones).
 *
 * Designed for small phones and older players: full-width buttons, large text, nothing that needs
 * scrolling sideways (checked by E2E at 360px wide).
 */
"use client";

import { useState } from "react";
import { answerStyle } from "@/lib/answer-style";
import { finalPayload, questionPayload, revealPayload, type SessionRow, type SessionStatus } from "@/lib/game-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCountdown } from "@/lib/use-countdown";
import { useLiveSession } from "@/lib/use-live-session";
import { t } from "@/strings/he";
import { QuestionImage } from "@/components/question-image";

type Props = { initialSession: SessionRow; playerId: string; initialScore: number };

const WAITING_TEXT: Partial<Record<SessionStatus, string>> = {
  lobby: t.play.waitingToStart,
  paused: t.play.paused,
  finished: t.play.ended,
};

export function PlayerGame({ initialSession, playerId, initialScore }: Props) {
  const { session, realtime } = useLiveSession(initialSession, { poll: false });
  const question = questionPayload(session);
  const reveal = revealPayload(session);

  const final = finalPayload(session);
  // Total score: final standings if the game is over, else the latest reveal (both computed by the
  // database), otherwise what the page loaded with.
  const score = final?.ranks[playerId]?.score ?? reveal?.results[playerId]?.score ?? initialScore;
  const myRank = final?.show_scores ? final.ranks[playerId]?.rank : undefined;

  const waiting = WAITING_TEXT[session.status];

  return (
    <div data-testid="player-game" data-status={session.status} className="flex w-full max-w-md flex-col items-center gap-5">
      {waiting && (
        <p data-testid="player-status" data-status={session.status} data-realtime={realtime} className="text-2xl">
          {waiting}
        </p>
      )}

      {session.status === "question" && question && (
        // key: a fresh component per question, so the "already answered" state resets.
        <AnswerPad key={question.question_id} sessionId={session.id} question={question} startedAt={session.question_started_at} />
      )}

      {session.status === "reveal" && question && reveal && (
        <Result
          correctText={question.options[reveal.correct_idx]}
          result={reveal.results[playerId]}
          showScores={reveal.show_scores}
        />
      )}

      {session.status === "finished" && myRank !== undefined && final && (
        <p data-testid="final-rank" className="text-3xl font-black">
          {t.play.yourPlace}: <bdi>{myRank}</bdi> {t.play.outOf} <bdi>{final.players}</bdi>
        </p>
      )}

      {(final?.show_scores ?? reveal?.show_scores ?? true) && (
        <p className="text-xl">
          {t.play.totalScore}: <bdi data-testid="player-score">{score}</bdi>
        </p>
      )}
    </div>
  );
}

/** Question text, answer buttons and countdown. One tap = one answer. */
function AnswerPad({
  sessionId,
  question,
  startedAt,
}: {
  sessionId: string;
  question: NonNullable<ReturnType<typeof questionPayload>>;
  startedAt: string | null;
}) {
  const storageKey = `answer:${question.question_id}`;
  // The chosen option, remembered on this phone so a reload still shows "answer received".
  // Concept — lazy initial state: the function runs once, on the first render only.
  // localStorage may be unavailable (private mode, some in-app browsers): then we just don't remember.
  const [chosen, setChosen] = useState<number | null>(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved === null ? null : Number(saved);
    } catch {
      return null;
    }
  });
  const [error, setError] = useState<string>();
  const remaining = useCountdown(startedAt, question.time_limit_sec);
  const timeUp = remaining === 0;
  // Derived, not stored: "time's up" simply follows from the countdown and whether we answered.
  const message = error ?? (timeUp && chosen === null ? t.play.timeUp : undefined);

  async function answer(index: number) {
    if (chosen !== null || timeUp) return; // one tap = one answer
    setChosen(index); // lock the buttons immediately, before the network replies
    const { error } = await getSupabaseBrowserClient().rpc("submit_answer", {
      p_session_id: sessionId,
      p_option_idx: index,
    });
    if (!error || error.message === "already_answered") {
      try {
        window.localStorage.setItem(storageKey, String(index));
      } catch {
        // not remembered on this phone: the database still has the answer
      }
      return;
    }
    if (error.message === "too_late" || error.message === "not_accepting_answers") {
      setError(t.play.timeUp);
      return;
    }
    setChosen(null); // network or other error: let the player try again
    setError(t.play.answerFailed);
  }

  return (
    <>
      <div className="flex w-full items-center justify-between gap-3">
        <h1 data-testid="phone-question" className="text-2xl font-bold leading-snug">
          {question.text}
        </h1>
        {remaining !== null && (
          <span data-testid="phone-countdown" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-purple-700 text-2xl font-black text-white">
            {remaining}
          </span>
        )}
      </div>
      {question.image_path && (
        <QuestionImage path={question.image_path} testId="phone-image" className="max-h-56 w-full" />
      )}

      {chosen !== null && !message ? (
        <div data-testid="answer-received" className="flex flex-col items-center gap-2 py-8 text-center">
          <span aria-hidden className={`${answerStyle(question.type, chosen).bg} rounded-xl px-6 py-3 text-4xl text-white`}>
            {answerStyle(question.type, chosen).symbol}
          </span>
          <p className="text-2xl font-bold">{t.play.answerReceived}</p>
          <p className="opacity-70">{t.play.waitForReveal}</p>
        </div>
      ) : (
        <ul className="grid w-full grid-cols-1 gap-3">
          {question.options.map((text, i) => {
            const style = answerStyle(question.type, i);
            return (
              <li key={i}>
                <button
                  type="button"
                  data-testid={`answer-${i}`}
                  onClick={() => void answer(i)}
                  disabled={chosen !== null || timeUp}
                  className={`${style.bg} flex min-h-16 w-full items-center gap-3 rounded-xl px-4 py-3 text-start text-xl font-bold text-white disabled:opacity-50`}
                >
                  <span aria-hidden className="text-2xl">{style.symbol}</span>
                  <span dir="auto">{text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {message && <p role="alert" data-testid="answer-message" className="text-xl">{message}</p>}
    </>
  );
}

/** After the reveal: right or wrong, points for this question. */
function Result({
  correctText,
  result,
  showScores,
}: {
  correctText: string;
  result: { correct: boolean | null; points: number } | undefined;
  showScores: boolean;
}) {
  const outcome = result?.correct === true ? "correct" : result?.correct === false ? "wrong" : "none";
  const text = outcome === "correct" ? t.play.correct : outcome === "wrong" ? t.play.wrong : t.play.noAnswer;
  const color = outcome === "correct" ? "bg-green-600" : outcome === "wrong" ? "bg-red-600" : "bg-gray-500";

  return (
    <div data-testid="phone-result" data-outcome={outcome} className={`${color} flex w-full flex-col items-center gap-2 rounded-xl p-6 text-white`}>
      <p className="text-3xl font-black">{text}</p>
      {outcome !== "correct" && (
        <p className="text-lg">
          {t.play.correctWas} <strong dir="auto">{correctText}</strong>
        </p>
      )}
      {showScores && (
        <p className="text-lg">
          <bdi data-testid="points-earned">{result?.points ?? 0}</bdi> {t.play.pointsEarned}
        </p>
      )}
    </div>
  );
}
