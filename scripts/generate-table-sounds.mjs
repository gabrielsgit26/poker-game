/**
 * Generates short mono 16-bit PCM WAV files for table UI (royalty-free procedural tones).
 * Run: node scripts/generate-table-sounds.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "apps", "web", "public", "sounds");

const SAMPLE_RATE = 22050;

function writeWavMono16(filepath, samples) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = SAMPLE_RATE * blockAlign;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-32768, Math.min(32767, samples[i] | 0));
    buffer.writeInt16LE(v, 44 + i * 2);
  }
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, buffer);
}

function sineTone(freq, seconds, amp = 0.22, fade = 0.004) {
  const n = Math.floor(SAMPLE_RATE * seconds);
  const samples = new Int16Array(n);
  const fadeN = Math.floor(SAMPLE_RATE * fade);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env =
      i < fadeN ? i / fadeN : i > n - fadeN ? (n - i) / fadeN : 1;
    const s = Math.sin(2 * Math.PI * freq * t) * amp * env * 32767;
    samples[i] = s;
  }
  return samples;
}

function mix(...parts) {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Int16Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function softChirp(f0, f1, seconds, amp = 0.14) {
  const n = Math.floor(SAMPLE_RATE * seconds);
  const samples = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = f0 + (f1 - f0) * t;
    const ang = (2 * Math.PI * f * i) / SAMPLE_RATE;
    const env = Math.sin((Math.PI * i) / n) ** 1.2;
    samples[i] = Math.sin(ang) * amp * env * 32767;
  }
  return samples;
}

function noiseBurst(seconds, amp = 0.06) {
  const n = Math.floor(SAMPLE_RATE * seconds);
  const samples = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const env = Math.exp(-8 * (i / n));
    samples[i] = (Math.random() * 2 - 1) * amp * env * 32767;
  }
  return samples;
}

const specs = {
  "your-turn.wav": mix(sineTone(520, 0.055, 0.2), sineTone(660, 0.04, 0.14, 0.06)),
  "board-street.wav": mix(sineTone(220, 0.04, 0.16), sineTone(330, 0.05, 0.12, 0.05)),
  "chips-to-pot.wav": mix(
    softChirp(95, 140, 0.07, 0.18),
    noiseBurst(0.04, 0.04),
  ),
  "pot-win.wav": mix(
    sineTone(392, 0.08, 0.2),
    sineTone(490, 0.09, 0.16, 0.08),
    sineTone(587, 0.11, 0.14, 0.12),
  ),
  "fold.wav": softChirp(180, 70, 0.14, 0.16),
  "hero-deal.wav": mix(sineTone(660, 0.03, 0.18), sineTone(780, 0.03, 0.14, 0.08)),
};

for (const [name, samples] of Object.entries(specs)) {
  const fp = path.join(outDir, name);
  writeWavMono16(fp, samples);
  console.log("Wrote", fp, `(${samples.length} samples)`);
}
