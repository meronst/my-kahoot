/**
 * components/ready-light.tsx — the "system ready" light on /host (KQ-21).
 *
 * Before a lecture the host wants one glance: will the game work right now? The light asks the
 * database a trivial question (the health() RPC) FROM THE BROWSER, the same path every phone will
 * use, every 30 seconds and whenever the tab comes back into view.
 *   green  — the database answered "ok"
 *   red    — no answer within 5 seconds, or an error (also when the free project was paused)
 *   grey   — checking for the first time
 */
"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { t } from "@/strings/he";

type State = "checking" | "ready" | "down";
const INTERVAL_MS = 30_000;
const TIMEOUT_MS = 5_000;

async function check(): Promise<boolean> {
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), TIMEOUT_MS));
  const call = getSupabaseBrowserClient()
    .rpc("health")
    .then(({ data, error }) => !error && data === "ok", () => false);
  return Promise.race([call, timeout]);
}

const STYLE: Record<State, { dot: string; text: string }> = {
  checking: { dot: "bg-gray-400", text: t.ready.checking },
  ready: { dot: "bg-green-500", text: t.ready.ok },
  down: { dot: "bg-red-600", text: t.ready.down },
};

export function ReadyLight() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let alive = true;
    const run = () => void check().then((ok) => alive && setState(ok ? "ready" : "down"));
    run();
    const timer = setInterval(run, INTERVAL_MS);
    const onVisible = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <p data-testid="ready-light" data-state={state} role="status" className="flex items-center gap-2">
      <span aria-hidden className={`inline-block size-3 rounded-full ${STYLE[state].dot}`} />
      <span>{STYLE[state].text}</span>
    </p>
  );
}
