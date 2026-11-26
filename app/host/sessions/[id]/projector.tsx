/**
 * app/host/sessions/[id]/projector.tsx — the projector: one screen that follows the game live.
 *
 * It renders whatever the session's status says (lobby → question → reveal → … → paused → finished)
 * and gives the host ONE main button for the next legal move (also on the Space key, for a clicker
 * or keyboard while standing at the lectern). Each button calls a game-engine function in the
 * database; the database decides whether the move is allowed.
 *
 * After an action, the returned row is shown immediately; Realtime/polling then confirm it on every
 * screen. useLiveSession only moves forward, so the duplicate updates are harmless.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { finalPayload, questionPayload, revealPayload, type SessionRow } from "@/lib/game-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useLiveSession } from "@/lib/use-live-session";
import { t } from "@/strings/he";
import { LobbyPlayers, useLivePlayers, type Player } from "./lobby-players";
import { FinalScreen } from "./final-screen";
import { PauseScreen } from "./pause-screen";
import { QuestionScreen } from "./question-screen";
import { RevealScreen } from "./reveal-screen";

type Move = "start_session" | "reveal_question" | "next_question" | "resume_session" | "finish_session";

type Props = {
  initialSession: SessionRow;
  initialPlayers: Player[];
  title: string;
  /** CSV download of phone numbers, when the quiz collects them (KQ-19). */
  phonesHref: string | null;
  joinUrl: string;
  qrSvg: string;
};

export function Projector({ initialSession, initialPlayers, title, phonesHref, joinUrl, qrSvg }: Props) {
  const { session, setSession, realtime } = useLiveSession(initialSession);
  const { players, realtimeStatus: playersRealtime } = useLivePlayers(session.id, initialPlayers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const busyRef = useRef(false); // guards against a second press before React re-renders

  const run = useCallback(
    async (move: Move) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError(undefined);
      const { data, error: rpcError } = await getSupabaseBrowserClient().rpc(move, { p_session_id: session.id });
      if (data) setSession(data);
      // "invalid_state" just means another trigger already moved the game (e.g. auto-reveal and a
      // click at the same moment). Not worth alarming the host about.
      if (rpcError && !rpcError.message.startsWith("invalid_state")) setError(t.projector.actionFailed);
      busyRef.current = false;
      setBusy(false);
    },
    [session.id, setSession],
  );

  // The main move for the current state. useMemo keeps the same object while the status is the same,
  // so the keyboard listener below isn't re-attached on every render.
  const primary = useMemo<{ move: Move; label: string } | null>(() => {
    switch (session.status) {
      case "lobby": return { move: "start_session", label: t.projector.start };
      case "question": return { move: "reveal_question", label: t.projector.reveal };
      case "reveal": return { move: "next_question", label: t.projector.next };
      case "paused": return { move: "resume_session", label: t.projector.resume };
      default: return null;
    }
  }, [session.status]);

  // Space bar = main button (ignored while typing in a field, if there ever is one).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !primary || (e.target as HTMLElement).closest("input, textarea")) return;
      e.preventDefault();
      if (session.status === "lobby" && players.length === 0) return;
      void run(primary.move);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [primary, run, session.status, players.length]);

  const question = questionPayload(session);
  const reveal = revealPayload(session);
  const onShouldReveal = useCallback(() => void run("reveal_question"), [run]);

  return (
    <div
      data-testid="projector"
      data-status={session.status}
      data-realtime={realtime}
      className="flex w-full flex-1 flex-col items-center gap-8"
    >
      {session.status === "lobby" && (
        <>
          <h1 className="text-4xl font-bold">{title}</h1>
          <JoinInfo pin={session.pin} joinUrl={joinUrl} qrSvg={qrSvg} />
          <LobbyPlayers players={players} realtimeStatus={playersRealtime} />
        </>
      )}

      {session.status === "question" && question && (
        <QuestionScreen
          // `key` = a new component per question, so its countdown and counters start fresh.
          key={question.question_id}
          sessionId={session.id}
          question={question}
          startedAt={session.question_started_at}
          playerCount={players.length}
          onShouldReveal={onShouldReveal}
        />
      )}

      {session.status === "reveal" && question && reveal && <RevealScreen question={question} reveal={reveal} />}

      {session.status === "paused" && (
        <PauseScreen
          // While paused, round_idx already points at the round that comes next (0-based).
          nextRound={session.round_idx + 1}
          roundCount={question?.round_count ?? null}
          reveal={reveal}
          joinInfo={<JoinInfo pin={session.pin} joinUrl={joinUrl} qrSvg={qrSvg} />}
        />
      )}
      {session.status === "finished" && <FinalScreen final={finalPayload(session)} phonesHref={phonesHref} />}

      <div className="flex flex-col items-center gap-2">
        {primary && (
          <button
            type="button"
            data-testid="primary-action"
            onClick={() => void run(primary.move)}
            disabled={busy || (session.status === "lobby" && players.length === 0)}
            className="rounded-xl bg-blue-600 px-10 py-4 text-3xl font-bold text-white disabled:opacity-50"
          >
            {session.status === "lobby" && players.length === 0 ? t.projector.needPlayers : primary.label}
          </button>
        )}
        {error && <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>}
        {primary && <p className="text-sm opacity-60">{t.projector.keyboardHint}</p>}
        {(session.status === "reveal" || session.status === "paused") && (
          <EndEarly onConfirm={() => void run("finish_session")} disabled={busy} />
        )}
      </div>
    </div>
  );
}

/**
 * Ends the game before the last question (e.g. the lecture ran out of time). Two clicks: the first
 * arms it and changes the label, the second ends the game. An inline confirm instead of a browser
 * dialog keeps it usable on a projector with a clicker. It disarms itself after 5 seconds.
 */
function EndEarly({ onConfirm, disabled }: { onConfirm: () => void; disabled: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <button
      type="button"
      data-testid="end-early"
      disabled={disabled}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className={`mt-2 rounded-lg border px-4 py-2 text-sm ${armed ? "border-red-600 text-red-600" : "border-current/30 opacity-70"}`}
    >
      {armed ? t.projector.endEarlyConfirm : t.projector.endEarly}
    </button>
  );
}

function JoinInfo({ pin, joinUrl, qrSvg }: { pin: string; joinUrl: string; qrSvg: string }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-2xl">{t.lobby.joinAt}</p>
        {/* The join address is Latin text: <bdi> keeps it readable inside the RTL layout. */}
        <bdi className="text-2xl font-bold" dir="ltr">{joinUrl.replace(/^https?:\/\//, "")}</bdi>
        <p className="text-xl">{t.lobby.pinLabel}</p>
        <bdi data-testid="session-pin" dir="ltr" className="text-7xl font-black tracking-widest">{pin}</bdi>
        <p className="max-w-xs opacity-70">{t.lobby.scanOrEnter}</p>
      </div>
      <div
        role="img"
        aria-label={t.lobby.qrAlt}
        data-testid="join-qr"
        className="size-64 rounded-lg bg-white p-2"
        // Safe: the SVG comes from our own QR library, not from user input.
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
    </div>
  );
}
