/**
 * app/host/sessions/[id]/question-screen.tsx — the projector during a question.
 *
 * Shows the question, the four colored options, a countdown and how many players answered.
 * Tells the parent when answering should close (time's up, or everyone answered), so the projector
 * can trigger the reveal automatically. The deadline itself is still enforced by the database.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { answerStyle } from "@/lib/answer-style";
import type { QuestionPayload } from "@/lib/game-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCountdown } from "@/lib/use-countdown";
import { t } from "@/strings/he";

type Props = {
  sessionId: string;
  question: QuestionPayload;
  startedAt: string | null;
  playerCount: number;
  onShouldReveal: () => void;
};

export function QuestionScreen({ sessionId, question, startedAt, playerCount, onShouldReveal }: Props) {
  const remaining = useCountdown(startedAt, question.time_limit_sec);
  const answered = useAnswerCount(sessionId, question.question_id);

  // Close answering when time is up or everyone has answered, once.
  // Concept — useRef: a value the component remembers WITHOUT re-rendering when it changes
  // (unlike useState). Right for a "did we already do this?" flag.
  const fired = useRef(false);
  const everyoneAnswered = playerCount > 0 && answered >= playerCount;
  useEffect(() => {
    if (!fired.current && (remaining === 0 || everyoneAnswered)) {
      fired.current = true;
      onShouldReveal();
    }
  }, [remaining, everyoneAnswered, onShouldReveal]);

  return (
    <div className="flex w-full max-w-6xl flex-1 flex-col gap-6">
      <div className="flex items-center justify-between text-xl opacity-80">
        <span>
          {t.projector.roundOf} {question.round_idx + 1} {t.projector.of} {question.round_count} ·{" "}
          {t.projector.questionOf} {question.question_idx + 1} {t.projector.of} {question.round_size}
        </span>
        <span data-testid="answered-count">
          {t.projector.answered}: <bdi>{answered}</bdi> / <bdi>{playerCount}</bdi>
        </span>
      </div>

      <h1 data-testid="projector-question" className="text-center text-5xl font-bold leading-tight">
        {question.text}
      </h1>

      <div className="flex justify-center">
        {remaining === null ? (
          <span className="text-2xl opacity-70">{t.projector.noTimer}</span>
        ) : (
          <span
            data-testid="countdown"
            aria-label={`${remaining} ${t.projector.secondsLeft}`}
            className="flex size-28 items-center justify-center rounded-full bg-purple-700 text-5xl font-black text-white"
          >
            {remaining}
          </span>
        )}
      </div>

      <ul className="grid flex-1 grid-cols-2 gap-4">
        {question.options.map((text, i) => {
          const style = answerStyle(question.type, i);
          return (
            <li key={i} className={`${style.bg} flex items-center gap-4 rounded-xl p-6 text-3xl font-bold text-white`}>
              <span aria-hidden className="text-4xl">{style.symbol}</span>
              <span dir="auto">{text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Live count of answers to one question. Realtime INSERT events for speed, plus a light poll
 * (projector only) as the safety net from bug KQ-28. The database decides what's counted: the host
 * can read answers of their own session (RLS); phones can't.
 */
function useAnswerCount(sessionId: string, questionId: string): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;
    const load = async () => {
      const { count: n } = await supabase
        .from("answers").select("id", { count: "exact", head: true })
        .eq("session_id", sessionId).eq("question_id", questionId);
      if (!cancelled && n !== null) setCount((c) => Math.max(c, n));
    };
    void load();
    const channel = supabase
      .channel(`answers:${sessionId}:${questionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "answers", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.new.question_id === questionId) setCount((c) => c + 1);
        },
      )
      .subscribe();
    const poll = setInterval(load, 1500);
    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [sessionId, questionId]);
  return count;
}
