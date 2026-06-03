/**
 * Procedural table audio (Web Audio API) — Phase 12 polish.
 * Respects Settings → Sound (`poker:pref:sound`). No external assets.
 */
import { readPref } from "@/lib/settings/prefs";

let audioCtx: AudioContext | null = null;
let lastChipsToPotAt = 0;

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

/** Bets / blinds sliding toward pot (throttled). */
export function playChipsToPot(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastChipsToPotAt < 90) return;
  lastChipsToPotAt = now;
  resumeTableAudio();
  beep(ctx, 95, 0.055, 0.065, "triangle", 0);
  beep(ctx, 140, 0.04, 0.035, "sine", 0.028);
}

/** Pot ships to winner seat(s). */
export function playPotToWinners(): void {
  const ctx = getCtx();
  if (!ctx) return;
  resumeTableAudio();
  const base = 392; // G4
  beep(ctx, base, 0.07, 0.07, "sine", 0);
  beep(ctx, base * 1.25, 0.08, 0.065, "sine", 0.09);
  beep(ctx, base * 1.5, 0.1, 0.06, "sine", 0.2);
}

/** New board cards. */
export function playBoardStreet(): void {
  const ctx = getCtx();
  if (!ctx) return;
  resumeTableAudio();
  beep(ctx, 220, 0.04, 0.045, "sine", 0);
  beep(ctx, 330, 0.05, 0.04, "sine", 0.05);
}

/** Hero hole cards appear. */
export function playHeroHoleDeal(): void {
  const ctx = getCtx();
  if (!ctx) return;
  resumeTableAudio();
  beep(ctx, 660, 0.028, 0.04, "sine", 0);
  beep(ctx, 780, 0.028, 0.035, "sine", 0.07);
}

/** Subtle cue when action is on you. */
export function playYourTurn(): void {
  const ctx = getCtx();
  if (!ctx) return;
  resumeTableAudio();
  beep(ctx, 520, 0.045, 0.042, "sine", 0);
}

/** Player folded (local action feedback). */
export function playFold(): void {
  const ctx = getCtx();
  if (!ctx) return;
  resumeTableAudio();
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
}
