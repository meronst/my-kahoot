/**
 * app/play/[sessionId]/player-status.tsx — the live "what's happening now" line on the phone.
 *
 * Follows the session row through Realtime (UPDATE events on `sessions`, filtered to this session).
 * Applies the lessons from bug KQ-28 (docs/architecture.md), with one difference from the projector:
 *   - token first, then subscribe; treat the channel as live only after the `system` "ok" event;
 *   - NO fast polling: 150 phones polling would load the database 150×. Instead the phone re-reads
 *     the state at moments where it may have missed something: when the channel becomes live, and
 *     when the phone comes back to the foreground (screen unlocked, app switched back).
 */
"use client";

import { useEffect, useState } from "react";
import type { Database } from "@/lib/database.types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { t } from "@/strings/he";

type Status = Database["public"]["Enums"]["session_status"];

const STATUS_TEXT: Record<Status, string> = {
  lobby: t.play.waitingToStart,
  question: t.play.inProgress,
  reveal: t.play.inProgress,
  paused: t.play.paused,
  finished: t.play.ended,
};

export function PlayerStatus({ sessionId, initialStatus }: { sessionId: string; initialStatus: Status }) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [realtimeStatus, setRealtimeStatus] = useState("CONNECTING");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    /** Re-read the current state from the database (the source of truth). */
    const resync = async () => {
      const { data } = await supabase.from("sessions").select("status").eq("id", sessionId).single();
      if (data && !cancelled) setStatus(data.status);
    };

    async function subscribe() {
      await supabase.auth.getSession();
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel(`play:${sessionId}`, { config: { broadcast: { replication_ready: true } } })
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
          (payload) => setStatus(payload.new.status as Status),
        )
        .on("system", {}, (payload: { extension: string; status: string }) => {
          if (payload.extension !== "system") return;
          setRealtimeStatus(payload.status === "ok" ? "READY" : "REPLICATION_ERROR");
          void resync();
        })
        .subscribe((s) => {
          if (s !== "SUBSCRIBED") setRealtimeStatus(s);
        });
    }
    void subscribe();

    // Phone unlocked / tab shown again: the socket may have dropped meanwhile, so re-read the state.
    const onVisible = () => {
      if (document.visibilityState === "visible") void resync();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return (
    <p data-testid="player-status" data-status={status} data-realtime={realtimeStatus} className="text-2xl">
      {STATUS_TEXT[status]}
    </p>
  );
}
