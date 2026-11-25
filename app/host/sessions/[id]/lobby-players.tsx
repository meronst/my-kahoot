/**
 * app/host/sessions/[id]/lobby-players.tsx — the live list of joined players on the projector (KQ-7).
 *
 * Starts with the players the server already found, then listens for new ones through Supabase
 * Realtime and adds them as they arrive, with no page reload.
 *
 * Concept — useEffect: code that should run after the component appears on screen (and clean up when
 * it disappears). Here: open the Realtime subscription on mount, close it on unmount. The `return`
 * function inside useEffect is the cleanup. Think try/finally around the component's lifetime.
 *
 * Concept — useState: a value the component remembers; calling the setter re-renders the list.
 */
"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { t } from "@/strings/he";

type Player = { id: string; nickname: string };

export function LobbyPlayers({ sessionId, initialPlayers }: { sessionId: string; initialPlayers: Player[] }) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    /** Adds players we don't have yet (the same player may arrive twice: initial load + event). */
    const merge = (incoming: Player[]) =>
      setPlayers((current) => {
        const known = new Set(current.map((p) => p.id));
        return [...current, ...incoming.filter((p) => !known.has(p.id))];
      });

    const channel = supabase
      .channel(`lobby:${sessionId}`)
      // Fires for every new row in `players` for this session. RLS on the server ensures the host
      // only receives rows of their own sessions.
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "players", filter: `session_id=eq.${sessionId}` },
        (payload) => merge([{ id: payload.new.id as string, nickname: payload.new.nickname as string }]),
      )
      .subscribe(async (status) => {
        // Players who joined between the server render and this subscription would be missed by
        // the events alone, so once we're listening, load the full list once more.
        if (status === "SUBSCRIBED") {
          const { data } = await supabase
            .from("players").select("id, nickname").eq("session_id", sessionId).order("joined_at");
          if (data) merge(data);
        }
      });

    return () => {
      supabase.removeChannel(channel); // cleanup: close the subscription when leaving the page
    };
  }, [sessionId]);

  return (
    <section className="w-full max-w-4xl">
      <h2 className="mb-4 text-center text-2xl">
        {t.lobby.playersJoined}: <bdi data-testid="player-count">{players.length}</bdi>
      </h2>
      {players.length === 0 ? (
        <p className="text-center opacity-70">{t.lobby.waitingForPlayers}</p>
      ) : (
        <ul data-testid="lobby-players" className="flex flex-wrap justify-center gap-3">
          {players.map((p) => (
            <li key={p.id} className="rounded-full bg-blue-600 px-4 py-2 text-xl font-bold text-white">
              {/* Nicknames may be Hebrew or English: dir="auto" picks the right direction per name. */}
              <bdi dir="auto">{p.nickname}</bdi>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
