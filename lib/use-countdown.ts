/**
 * lib/use-countdown.ts — a countdown that follows the DATABASE clock, not the device clock.
 *
 * A phone or laptop clock can be off by seconds. The deadline is decided by the database
 * (submit_answer), so the screens should count down by the same clock. On mount we ask the
 * database for its time once (server_time()), compute the offset, and then tick locally.
 *
 * Concept — custom hooks: a function starting with `use` that combines other hooks (useState,
 * useEffect) so components can share behavior. Like a small reusable helper class with its own state.
 */
"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Pure: seconds left, rounded up, never below 0. Exported for unit tests. */
export function secondsLeft(startedAtMs: number, limitSec: number, nowMs: number): number {
  return Math.max(0, Math.ceil((startedAtMs + limitSec * 1000 - nowMs) / 1000));
}

/** server time − device time, in ms. 0 until known. */
function useServerClockOffset(): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sentAt = Date.now();
      const { data } = await getSupabaseBrowserClient().rpc("server_time");
      const receivedAt = Date.now();
      if (cancelled || typeof data !== "string") return;
      // Assume the reply took half the round trip to arrive.
      setOffset(Date.parse(data) - (sentAt + receivedAt) / 2);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return offset;
}

/**
 * Seconds remaining for a question, or null when there's no timer.
 * Re-renders 4 times a second so the display never lags a full second behind.
 */
export function useCountdown(startedAt: string | null, limitSec: number | null): number | null {
  const offset = useServerClockOffset();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (limitSec === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [limitSec]);
  if (limitSec === null || startedAt === null) return null;
  return secondsLeft(Date.parse(startedAt), limitSec, now + offset);
}
