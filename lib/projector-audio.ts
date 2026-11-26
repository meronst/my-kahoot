/**
 * lib/projector-audio.ts — the projector's sounds, made in the browser with the Web Audio API (KQ-20).
 *
 * Why synthesized instead of audio files: no licensing questions about music, nothing to download,
 * and the volume and length are easy to keep gentle for a lecture hall.
 *
 * Concept — Web Audio: an AudioContext is a little sound studio. An OscillatorNode makes a tone
 * (a frequency, a wave shape), a GainNode is a volume knob; we connect oscillator → gain → master →
 * speakers and tell each note exactly when to start and stop (times in seconds on the context's clock).
 *
 * Browsers only allow sound after the user clicks or presses a key on the page ("autoplay policy").
 * So the engine starts silent; unlock() is called on the host's first click/keypress.
 *
 * Only the projector imports this file. The phones never do (acceptance: no audio on phones).
 */
import type { Effect } from "@/lib/sound-plan";

type Note = { freq: number; at: number; length: number; volume?: number; wave?: OscillatorType };

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12); // MIDI note number → frequency

const EFFECTS: Record<Effect, Note[]> = {
  // rising two-note chime: "here comes a question"
  question: [{ freq: hz(72), at: 0, length: 0.18 }, { freq: hz(79), at: 0.16, length: 0.35 }],
  // a short, quiet woodblock-like blip
  tick: [{ freq: hz(84), at: 0, length: 0.06, volume: 0.35, wave: "square" }],
  // bright major arpeggio
  reveal: [72, 76, 79, 84].map((n, i) => ({ freq: hz(n), at: i * 0.09, length: 0.4 })),
  // a small fanfare for the end
  finale: [
    ...[67, 72, 76].map((n, i) => ({ freq: hz(n), at: i * 0.14, length: 0.2 })),
    { freq: hz(79), at: 0.45, length: 0.25 }, { freq: hz(76), at: 0.7, length: 0.15 }, { freq: hz(79), at: 0.85, length: 0.8 },
    { freq: hz(48), at: 0.85, length: 0.8, volume: 0.6, wave: "sine" },
  ],
  // a soft "pop" when someone joins
  join: [{ freq: hz(88), at: 0, length: 0.08, volume: 0.4, wave: "sine" }],
};

// Lobby music: a calm loop of 8 bars, 4 notes each (pentatonic, so nothing ever clashes), with a bass note per bar.
const BEAT = 0.3; // seconds per note (100 BPM in eighths)
const CHORDS = [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]];
const LOOP: Note[] = CHORDS.flatMap((chord, bar) => [
  ...[0, 1, 2, 3, 2, 1, 2, 3].map((idx, i) => ({ freq: hz(chord[idx] + 12), at: (bar * 8 + i) * BEAT, length: BEAT * 0.9, volume: 0.22 })),
  { freq: hz(chord[0] - 12), at: bar * 8 * BEAT, length: BEAT * 7.5, volume: 0.25, wave: "sine" as const },
]);
const LOOP_LENGTH = CHORDS.length * 8 * BEAT;

export class ProjectorAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private musicWanted = false;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  /** The music's own volume knob, so stopping the music can't silence an effect played at the same moment. */
  private musicBus: GainNode | null = null;
  private nextLoopAt = 0;

  /** Call from a click/keypress handler: creates or wakes the audio context. */
  unlock(): void {
    if (typeof window === "undefined" || !("AudioContext" in window)) return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    void this.ctx.resume();
    if (this.musicWanted) this.startMusicLoop();
  }

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    if (muted) this.stopMusicLoop();
    else if (this.musicWanted) this.startMusicLoop();
  }

  play(effect: Effect): void {
    if (this.muted || !this.ctx) return;
    if (this.master) this.schedule(EFFECTS[effect], this.ctx.currentTime + 0.02, this.master);
  }

  setMusic(on: boolean): void {
    this.musicWanted = on;
    if (on && !this.muted) this.startMusicLoop();
    else this.stopMusicLoop();
  }

  dispose(): void {
    this.stopMusicLoop();
    void this.ctx?.close();
    this.ctx = null;
  }

  private schedule(notes: Note[], start: number, output: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.wave ?? "triangle";
      osc.frequency.value = n.freq;
      const t0 = start + n.at;
      // A quick fade in and a longer fade out: no clicks, softer sound.
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(n.volume ?? 0.5, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + n.length);
      osc.connect(gain).connect(output);
      osc.start(t0);
      osc.stop(t0 + n.length + 0.05);
    }
  }

  /** Schedules the loop a little ahead of time, checking every 250ms (smooth even if the page is busy). */
  private startMusicLoop(): void {
    if (this.musicTimer || !this.ctx || !this.master) return;
    const bus = this.ctx.createGain();
    bus.connect(this.master);
    this.musicBus = bus;
    this.nextLoopAt = this.ctx.currentTime + 0.1;
    const fill = () => {
      if (!this.ctx) return;
      while (this.nextLoopAt < this.ctx.currentTime + 1) {
        this.schedule(LOOP, this.nextLoopAt, bus);
        this.nextLoopAt += LOOP_LENGTH;
      }
    };
    fill();
    this.musicTimer = setInterval(fill, 250);
  }

  private stopMusicLoop(): void {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    // Notes already scheduled on the bus would keep playing: fade the bus out, then unplug it.
    const bus = this.musicBus;
    this.musicBus = null;
    if (bus && this.ctx) {
      bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      setTimeout(() => bus.disconnect(), 600);
    }
  }
}
