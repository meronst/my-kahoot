/**
 * app/play/[sessionId]/page.tsx — the player's screen on their phone (/play/<sessionId>).
 *
 * Server part: finds this phone's player and the session, then hands them to <PlayerGame>, which
 * follows the game live (questions, answers, results: KQ-11).
 *
 * Reconnect: the player is identified by their anonymous login (cookie), not by anything in the URL.
 * After a reload or a locked phone, the server finds "my player row in this session" through RLS
 * (players: user_id = auth.uid()), so the same name and score come back.
 */
import Link from "next/link";
import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { t } from "@/strings/he";
import { PlayerGame } from "./player-game";

export default function PlayPage({ params }: PageProps<"/play/[sessionId]">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <Suspense fallback={<p>…</p>}>
        <Play params={params} />
      </Suspense>
    </main>
  );
}

async function Play({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const supabase = await createSupabaseServerClient();

  // RLS returns only MY player row (or nothing if this phone never joined this session).
  const { data: player } = await supabase
    .from("players").select("id, nickname, score").eq("session_id", sessionId).maybeSingle();
  if (!player) {
    return (
      <>
        <p data-testid="not-joined" className="text-2xl">{t.play.notJoined}</p>
        <Link href="/" className="underline">{t.join.backHome}</Link>
      </>
    );
  }

  // Readable because I'm a player in it (RLS: is_player_in).
  const { data: session } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
  if (!session) return <p data-testid="not-joined" className="text-2xl">{t.play.notJoined}</p>;

  return (
    <>
      <p data-testid="player-nickname" className="text-lg opacity-80">
        <bdi dir="auto">{player.nickname}</bdi>
      </p>
      <PlayerGame initialSession={session} playerId={player.id} initialScore={player.score} />
    </>
  );
}
