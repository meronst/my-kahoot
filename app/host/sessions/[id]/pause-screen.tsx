/**
 * app/host/sessions/[id]/pause-screen.tsx — the projector between rounds (KQ-13).
 *
 * The host is back on the slides tab during the pause, but if someone glances at the quiz tab (or the
 * host switches back early) it shows: the standings so far, which round comes next, and the PIN + QR
 * for anyone who wants to join now (new players may join during a pause).
 *
 * The standings come from the last reveal (sessions.reveal_payload): the engine keeps it while paused.
 */
import type { RevealPayload } from "@/lib/game-types";
import { t } from "@/strings/he";

type Props = {
  nextRound: number;      // 1-based, for display
  roundCount: number | null;
  reveal: RevealPayload | null;
  joinInfo: React.ReactNode; // the PIN + QR block, rendered by the projector
};

export function PauseScreen({ nextRound, roundCount, reveal, joinInfo }: Props) {
  return (
    <div data-testid="paused" className="flex w-full max-w-6xl flex-col items-center gap-8">
      <h1 className="text-5xl font-bold">{t.projector.paused}</h1>
      <p data-testid="next-round" className="text-2xl">
        {t.projector.nextRound}: <bdi>{nextRound}</bdi>
        {roundCount !== null && (
          <>
            {" "}{t.projector.of} <bdi>{roundCount}</bdi>
          </>
        )}
      </p>

      {reveal?.show_scores && reveal.leaderboard.length > 0 && (
        <section className="w-full max-w-xl">
          <h2 className="mb-2 text-center text-2xl font-bold">{t.projector.standings}</h2>
          <ol data-testid="standings" className="flex flex-col gap-2">
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

      <section className="flex flex-col items-center gap-3">
        <p className="text-xl opacity-80">{t.projector.lateJoin}</p>
        {joinInfo}
      </section>
    </div>
  );
}
