/**
 * app/host/sessions/[id]/lobby-players.tsx — the live list of joined players (KQ-7), as a hook plus a
 * view.
 *
 * useLivePlayers() starts with the players the server already found, then listens for new ones
 * through Supabase Realtime. The projector uses it for the lobby list AND for the player count during
 * questions (to reveal early once everyone has answered).
 *
 * Reliability (bug KQ-28, docs/architecture.md): token first, "live" only after the replication-ready
 * system event, and a 1.5s poll as a safety net. Polling is fine here: one projector per session,
 * never on phones.
 *
 * Concept — useEffect: code that runs after the component appears (and cleans up when it goes).
 * Here: open the subscription on mount, close it on unmount. The returned function is the cleanup,
 * like try/finally around the component's lifetime.
 */
"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { t } from "@/strings/he";

export type Player = { id: string; nickname: string };

/** How often the projector re-checks the player list as a backup to Realtime. */
const LOBBY_POLL_MS = 1500;

export function useLivePlayers(sessionId: string, initialPlayers: Player[]) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [realtimeStatus, setRealtimeStatus] = useState("CONNECTING");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    /** Adds players we don't have yet (the same player may arrive twice: event + poll). */
    const merge = (incoming: Player[]) =>
      setPlayers((current) => {
        const known = new Set(current.map((p) => p.id));
        const fresh = incoming.filter((p) => !known.has(p.id));
        return fresh.length ? [...current, ...fresh] : current;
      });

    const reload = async () => {
      const { data } = await supabase
        .from("players").select("id, nickname").eq("session_id", sessionId).order("joined_at");
      if (data && !cancelled) merge(data);
    };

    (async () => {
      await supabase.auth.getSession();
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel(`lobby:${sessionId}`, { config: { broadcast: { replication_ready: true } } })
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "players", filter: `session_id=eq.${sessionId}` },
          (payload) => merge([{ id: payload.new.id as string, nickname: payload.new.nickname as string }]),
        )
        .on("system", {}, (payload: { extension: string; status: string }) => {
          if (payload.extension !== "system") return;
          setRealtimeStatus(payload.status === "ok" ? "READY" : "REPLICATION_ERROR");
          void reload();
        })
        .subscribe((s) => {
          if (s !== "SUBSCRIBED") setRealtimeStatus(s);
        });
    })();

    const poll = setInterval(reload, LOBBY_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
      if (channel) supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return { players, realtimeStatus };
}

export function LobbyPlayers({ players, realtimeStatus }: { players: Player[]; realtimeStatus: string }) {
  return (
    <section className="w-full max-w-4xl" data-testid="lobby" data-realtime={realtimeStatus}>
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
