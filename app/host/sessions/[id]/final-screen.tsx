/**
 * app/host/sessions/[id]/final-screen.tsx — the projector when the game is over (KQ-14).
 *
 * Scored quizzes: a podium for the top 3 (1st in the middle, 2nd and 3rd beside it, like a real
 * podium). Ties are shown as equal ranks. "results" mode (no scores): just the thank-you, no podium.
 * The data comes from sessions.final_payload, computed by the database when the game ended.
 */
import type { FinalPayload } from "@/lib/game-types";
import { t } from "@/strings/he";

const MEDAL = ["🥇", "🥈", "🥉"];
const HEIGHT = ["h-56", "h-40", "h-28"]; // podium block height by finishing place (1st, 2nd, 3rd)

export function FinalScreen({ final }: { final: FinalPayload | null }) {
  const podium = final?.show_scores ? final.podium : [];
  // Visual order on a podium: 2nd, 1st, 3rd. (In RTL the row reads right-to-left, so the first item
  // appears on the right; the 1st place stays in the middle either way.)
  const visual = [podium[1], podium[0], podium[2]].filter(Boolean);

  return (
    <div data-testid="finished" className="flex w-full max-w-5xl flex-col items-center gap-8">
      <h1 className="text-5xl font-bold">{t.projector.finished}</h1>

      {visual.length > 0 && (
        <section className="w-full">
          <h2 className="mb-4 text-center text-3xl font-bold">{t.projector.podium}</h2>
          <ol data-testid="podium" className="flex items-end justify-center gap-4">
            {visual.map((p) => {
              const place = Math.min(p.rank, 3) - 1;
              return (
                <li key={p.player_id} data-testid={`podium-rank-${p.rank}`} className="flex w-52 flex-col items-center gap-2">
                  <span className="text-5xl" aria-hidden>{MEDAL[place]}</span>
                  <bdi dir="auto" className="text-center text-2xl font-bold">{p.nickname}</bdi>
                  <bdi className="text-xl">{p.score}</bdi>
                  <div className={`${HEIGHT[place]} flex w-full items-start justify-center rounded-t-xl bg-purple-700 pt-3 text-4xl font-black text-white`}>
                    <bdi>{p.rank}</bdi>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <p className="text-3xl">{t.projector.thanks}</p>
    </div>
  );
}
