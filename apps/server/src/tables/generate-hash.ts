
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { fullDeck, shuffleWith, type HoldemFairness } from '../poker-engine/index.js';
import {
  generateServeHash,
} from './server-hash.js';

/**
 * Commit/reveal fair deal.
 *
 *   generateHash() -> { privateSeed, publicSeed }
 *     privateSeed = 32 random bytes (hex), kept server-side during the hand.
 *     publicSeed  = sha256(privateSeed), shown to players before the deal.
 *
 * The deck is derived from both seeds via an HMAC-SHA256 stream; rejection sampling
 * keeps every card position exactly uniform. After the hand, privateSeed is revealed
 * and anyone can confirm sha256(privateSeed) === publicSeed and rebuild the identical
 * deck from (privateSeed, publicSeed, nonce) alone.
 *
 * POKER_FAIRNESS_SALT, if set, is mixed in only when generating privateSeed — extra
 * server-side entropy. It never enters the deck derivation, so verification stays
 * fully self-contained and rotating the salt never invalidates past hands.
 */

const SALT = process.env.POKER_FAIRNESS_SALT ?? '';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export interface GeneratedHash {
  privateSeed: string;
  publicSeed: string;
}

export function generateHash(): GeneratedHash {
  const hash = generateServeHash();
  if(hash) return hash;
  // Salt (if any) only seasons generation; the resulting privateSeed is a plain
  // 32-byte hex value, and verification needs nothing but it.
  const raw = randomBytes(32).toString('hex');
  const privateSeed = SALT ? sha256Hex(`${SALT}:${raw}`) : raw;
  return { privateSeed, publicSeed: sha256Hex(privateSeed) };
}

/** Uniform integer source in [0, max) backed by HMAC-SHA256(privateSeed, publicSeed:nonce:round). */
function seedRandomInt(privateSeed: string, publicSeed: string, nonce: number) {
  const key = privateSeed;
  let round = 0;
  let block = Buffer.alloc(0);
  let offset = 0;

  const nextUint32 = (): number => {
    if (offset >= block.length) {
      block = createHmac('sha256', key).update(`${publicSeed}:${nonce}:${round++}`).digest();
      offset = 0;
    }
    const v = block.readUInt32BE(offset);
    offset += 4;
    return v;
  };

  return (max: number): number => {
    // Largest multiple of `max` below 2^32; values at/above it would bias low indices.
    const limit = Math.floor(0x1_0000_0000 / max) * max;
    let x: number;
    do {
      x = nextUint32();
    } while (x >= limit);
    return x % max;
  };
}

/** Builds the 52-card deck for a hand from its seeds. Deterministic for fixed inputs. */
export function deckFromHash(privateSeed: string, publicSeed: string, nonce: number): string[] {
  return shuffleWith(fullDeck(), seedRandomInt(privateSeed, publicSeed, nonce));
}

/** Fairness object for a new hand; `nonce` ties the seeds to a specific hand (e.g. handSeq). */
export function createHandFairness(nonce: number): HoldemFairness {
  const { privateSeed, publicSeed } = generateHash();
  return { privateSeed, publicSeed, nonce };
}

/** Recomputes a finished hand's deck; null if the revealed privateSeed doesn't match publicSeed. */
export function verifyHandDeck(f: HoldemFairness): string[] | null {
  if (sha256Hex(f.privateSeed) !== f.publicSeed) return null;
  return deckFromHash(f.privateSeed, f.publicSeed, f.nonce);
}
