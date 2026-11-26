/**
 * lib/use-projector-audio.ts — connects the game state to the projector's sounds (KQ-20).
 *
 * Concept — custom hook: a function starting with "use" that bundles React state and effects so a
 * component can reuse them in one line (like a small helper class the component owns).
 *
 * The engine lives in a ref (useRef): one object for the page's lifetime that React doesn't re-render for.
 */
"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { SessionStatus } from "@/lib/game-types";
import { ProjectorAudio } from "@/lib/projector-audio";
import { effectForTransition, musicFor, readMuted, tickFor, writeMuted } from "@/lib/sound-plan";

const storage = () => (typeof window === "undefined" ? undefined : window.localStorage);

/*
 * The mute switch as a tiny "external store" read with useSyncExternalStore: the server renders
 * "not muted" (it has no localStorage), the browser then reads the saved value without a hydration
 * mismatch. If storage is blocked, the choice lives in memory for this visit.
 */
let memoryMuted = false;
const listeners = new Set<() => void>();
const muteStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => readMuted(storage()) || memoryMuted,
  set(muted: boolean) {
    memoryMuted = muted;
    writeMuted(storage(), muted);
    listeners.forEach((l) => l());
  },
};

export function useProjectorAudio({ status, playerCount, secondsLeft }: { status: SessionStatus; playerCount: number; secondsLeft: number | null }) {
  const engine = useRef<ProjectorAudio | null>(null);
  const muted = useSyncExternalStore(muteStore.subscribe, muteStore.get, () => false);
  const [unlocked, setUnlocked] = useState(false);

  // Create the engine; wake it on the first click or keypress anywhere (browser autoplay rule).
  useEffect(() => {
    const audio = new ProjectorAudio();
    engine.current = audio;
    const unlock = () => {
      audio.unlock();
      setUnlocked(true);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      audio.dispose();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    engine.current?.setMuted(muted);
  }, [muted]);

  // Music while people join or chat. `unlocked` is a dependency so the music starts after the first click.
  useEffect(() => {
    engine.current?.setMusic(musicFor(status));
  }, [status, unlocked]);

  // One effect per state change (remember the previous status in a ref).
  const prevStatus = useRef<SessionStatus | null>(null);
  useEffect(() => {
    const effect = effectForTransition(prevStatus.current, status);
    prevStatus.current = status;
    if (effect) engine.current?.play(effect);
  }, [status]);

  // A pop when someone joins (not on the first render).
  const prevCount = useRef(playerCount);
  useEffect(() => {
    if (playerCount > prevCount.current && musicFor(status)) engine.current?.play("join");
    prevCount.current = playerCount;
  }, [playerCount, status]);

  // Ticks for the last 5 seconds.
  useEffect(() => {
    if (status === "question" && tickFor(secondsLeft)) engine.current?.play("tick");
  }, [secondsLeft, status]);

  return { muted, toggleMuted: () => muteStore.set(!muted), unlocked };
}
