/**
 * lib/use-live-session.ts — keeps a `sessions` row in sync with the database, live.
 *
 * Used by the projector and by phones. Applies the reliability rules from bug KQ-28
 * (docs/architecture.md): token before subscribing, and "live" only after the replication-ready
 * system event. The safety net differs:
 *   - projector (`poll: true`): re-reads every 1.5s; fine, there's ONE projector per session;
 *   - phones (`poll: false`): no polling (150 phones × polling = load); instead they re-read when the
 *     page becomes visible again (phone unlocked, app switched back), when a missed update is likely.
 *
 * Returns the current row, a setter (so a host action can show its result immediately instead of
 * waiting for the echo from Realtime), and the connection status for tests/debugging.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { progressKey, type SessionRow } from "@/lib/game-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const POLL_MS = 1500;

export function useLiveSession(initial: SessionRow, { poll = true }: { poll?: boolean } = {}) {
  const [session, setSessionState] = useState<SessionRow>(initial);
  const [realtime, setRealtime] = useState("CONNECTING");

  /**
   * Only ever move FORWARD: the same row arrives from several sources (the host action's reply, a
   * Realtime event, a poll), and an older one arriving late must not undo a newer one.
   * progressKey() orders states along the game; equal keys may still carry new data, so they're
   * accepted unless the row is identical.
   */
  const setSession = useCallback((next: SessionRow) => {
    setSessionState((current) => {
      if (progressKey(next) < progressKey(current)) return current;
      return JSON.stringify(current) === JSON.stringify(next) ? current : next;
    });
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    const reload = async () => {
      const { data } = await supabase.from("sessions").select("*").eq("id", initial.id).single();
      if (data && !cancelled) setSession(data);
    };

    (async () => {
      await supabase.auth.getSession();
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel(`session:${initial.id}`, { config: { broadcast: { replication_ready: true } } })
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${initial.id}` },
          (payload) => setSession(payload.new as SessionRow),
        )
        .on("system", {}, (payload: { extension: string; status: string }) => {
          if (payload.extension !== "system") return;
          setRealtime(payload.status === "ok" ? "READY" : "REPLICATION_ERROR");
          void reload();
        })
        .subscribe((s) => {
          if (s !== "SUBSCRIBED") setRealtime(s);
        });
    })();

    const timer = poll ? setInterval(reload, POLL_MS) : undefined;
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [initial.id, setSession, poll]);

  return { session, setSession, realtime };
}
