/**
 * app/host/sessions/[id]/lobby-players.tsx — the live list of joined players on the projector (KQ-7).
 *
 * Starts with the players the server already found, then listens for new ones through Supabase
 * Realtime and adds them as they arrive, with no page reload.
 *
 * Safety net: the list is also re-loaded every 1.5s while the lobby is open. In CI we saw the very
 * first Realtime event after the Realtime server starts get lost even after it reported "ready"
 * (bug KQ-28). Realtime stays the fast path (~0.8s); polling guarantees no player is ever missing
 * from the screen. Cost: one small query every 1.5s from the projector only, never from phones.
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

/** How often the lobby re-checks the player list as a backup to Realtime (see header comment). */
const LOBBY_POLL_MS = 1500;

export function LobbyPlayers({ sessionId, initialPlayers }: { sessionId: string; initialPlayers: Player[] }) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  // Subscription state, shown as a data attribute: lets tests (and DevTools) see whether we're live.
  const [realtimeStatus, setRealtimeStatus] = useState("CONNECTING");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false; // the page may close before the async setup below finishes

    /** Adds players we don't have yet (the same player may arrive twice: initial load + event). */
    const merge = (incoming: Player[]) =>
      setPlayers((current) => {
        const known = new Set(current.map((p) => p.id));
        return [...current, ...incoming.filter((p) => !known.has(p.id))];
      });

    async function subscribe() {
      // Realtime filters events with the database's RLS rules for whoever the socket says it is.
      // The login is in a cookie that the client loads asynchronously; if we subscribed right away,
      // the socket would connect as a not-logged-in visitor and receive nothing (bug KQ-28).
      // So: load the session first, then give Realtime the logged-in user's token.
      await supabase.auth.getSession();
      await supabase.realtime.setAuth();
      if (cancelled) return;

      // replication_ready: ask the server to tell us (a `system` event) when the database listener
      // behind this channel is actually live. "SUBSCRIBED" alone only means the channel is joined;
      // a player joining in the short gap before the listener is ready would be missed (KQ-28).
      channel = supabase
        .channel(`lobby:${sessionId}`, { config: { broadcast: { replication_ready: true } } })
        // Fires for every new row in `players` for this session. RLS on the server ensures the host
        // only receives rows of their own sessions.
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "players", filter: `session_id=eq.${sessionId}` },
          (payload) => merge([{ id: payload.new.id as string, nickname: payload.new.nickname as string }]),
        )
        .on("system", {}, async (payload: { extension: string; status: string }) => {
          if (payload.extension !== "system") return;
          setRealtimeStatus(payload.status === "ok" ? "READY" : "REPLICATION_ERROR");
          // Now that events flow, load the full list once more: catches anyone who joined between
          // the server render and this moment. From here on, events cover every new player.
          const { data } = await supabase
            .from("players").select("id, nickname").eq("session_id", sessionId).order("joined_at");
          if (data) merge(data);
        })
        .subscribe((status) => {
          // SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT / CLOSED. "READY" (above) comes after SUBSCRIBED.
          if (status !== "SUBSCRIBED") setRealtimeStatus(status);
        });
    }
    void subscribe();

    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("players").select("id, nickname").eq("session_id", sessionId).order("joined_at");
      if (data) merge(data);
    }, LOBBY_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(poll);
      if (channel) supabase.removeChannel(channel); // cleanup: close the subscription when leaving
    };
  }, [sessionId]);

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
