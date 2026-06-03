/**
 * Table audio: prefers short bundled WAV assets (`/sounds/*.wav`), falls back to Web Audio beeps.
 * Respects Settings → Sound (`poker:pref:sound`).
 */
import { readPref } from "@/lib/settings/prefs";

let audioCtx: AudioContext | null = null;
let lastChipsToPotAt = 0;

const SOUND_FILES = {
  yourTurn: "/sounds/your-turn.wav",
  boardStreet: "/sounds/board-street.wav",
  chipsToPot: "/sounds/chips-to-pot.wav",
  potWin: "/sounds/pot-win.wav",
  fold: "/sounds/fold.wav",
  heroDeal: "/sounds/hero-deal.wav",
} as const;

const bufferCache = new Map<string, AudioBuffer | "loading" | null>();

function soundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return readPref("sound", "1") === "1";
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined" || !soundEnabled()) return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
}

async function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  const hit = bufferCache.get(url);
  if (hit === "loading") return null;
  if (hit instanceof AudioBuffer) return hit;
  if (hit === null) return null;
  bufferCache.set(url, "loading");
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error(String(res.status));
    const arr = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr.slice(0));
    bufferCache.set(url, buf);
    return buf;
  } catch {
    bufferCache.set(url, null);
    return null;
  }
}

function playBuffer(ctx: AudioContext, buf: AudioBuffer, gain = 0.55): void {
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = buf;
  g.gain.setValueAtTime(gain, ctx.currentTime);
  src.connect(g);
  g.connect(ctx.destination);
  src.start();
}

/** Call from first pointerdown on the table so mobile Safari unlocks audio. */
export function resumeTableAudio(): void {
  const c = getCtx();
  if (c?.state === "suspended") void c.resume();
}

function beep(
  ctx: AudioContext,
  freq: number,
  duration: number,
  gain = 0.08,
  type: OscillatorType = "sine",
  when = 0,
): void {
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

async function playAssetOr(
  url: string,
  procedural: (ctx: AudioContext) => void,
): Promise<void> {
  const ctx = getCtx();
  if (!ctx) return;
  resumeTableAudio();
  const buf = await loadBuffer(ctx, url);
  if (buf) {
    playBuffer(ctx, buf);
    return;
  }
  procedural(ctx);
}

/** Bets / blinds sliding toward pot (throttled). */
export function playChipsToPot(): void {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastChipsToPotAt < 90) return;
  lastChipsToPotAt = now;
  void playAssetOr(SOUND_FILES.chipsToPot, (ctx) => {
    beep(ctx, 95, 0.055, 0.065, "triangle", 0);
    beep(ctx, 140, 0.04, 0.035, "sine", 0.028);
  });
}

/** Pot ships to winner seat(s). */
export function playPotToWinners(): void {
  void playAssetOr(SOUND_FILES.potWin, (ctx) => {
    const base = 392;
    beep(ctx, base, 0.07, 0.07, "sine", 0);
    beep(ctx, base * 1.25, 0.08, 0.065, "sine", 0.09);
    beep(ctx, base * 1.5, 0.1, 0.06, "sine", 0.2);
  });
}

/** New board cards. */
export function playBoardStreet(): void {
  void playAssetOr(SOUND_FILES.boardStreet, (ctx) => {
    beep(ctx, 220, 0.04, 0.045, "sine", 0);
    beep(ctx, 330, 0.05, 0.04, "sine", 0.05);
  });
}

/** Hero hole cards appear. */
export function playHeroHoleDeal(): void {
  void playAssetOr(SOUND_FILES.heroDeal, (ctx) => {
    beep(ctx, 660, 0.028, 0.04, "sine", 0);
    beep(ctx, 780, 0.028, 0.035, "sine", 0.07);
  });
}

/** Subtle cue when action is on you. */
export function playYourTurn(): void {
  void playAssetOr(SOUND_FILES.yourTurn, (ctx) => {
    beep(ctx, 520, 0.045, 0.042, "sine", 0);
  });
}

/** Player folded (local action feedback). */
export function playFold(): void {
  void playAssetOr(SOUND_FILES.fold, (ctx) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    osc.type = "sawtooth";
    const t0 = ctx.currentTime;
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.11);
    f.type = "lowpass";
    f.frequency.setValueAtTime(900, t0);
    f.frequency.exponentialRampToValueAtTime(220, t0 + 0.12);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
    osc.connect(f);
    f.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.15);
  });
}

/** Warm the decode cache after user gesture (optional). */
export function prefetchTableSounds(): void {
  const ctx = getCtx();
  if (!ctx) return;
  for (const url of Object.values(SOUND_FILES)) {
    void loadBuffer(ctx, url);
  }
}
