/**
 * Public Hold'em types the web client consumes from the server's snapshot payload.
 * Kept here (types only) so the web app has no dependency on the server engine.
 * The authoritative engine lives in apps/server/src/poker-engine.
 */

export type HoldemStreet = "preflop" | "flop" | "turn" | "river";
export type HoldemPhase = "betting" | "showdown" | "complete";

/** Commit/reveal data; `privateSeed` is present only once the hand is complete. */
export interface HoldemPublicFairness {
  publicSeed: string;
  nonce: number;
  privateSeed?: string;
}

export interface HoldemPublicSnapshot {
  handSeq: number;
  phase: HoldemPhase;
  street: HoldemStreet;
  board: readonly string[];
  pot: number;
  maxStreetBet: number;
  minRaise: number;
  buttonSeat: number;
  sbSeat: number;
  bbSeat: number;
  toActSeat: number | null;
  seats: Record<
    string,
    { stack: number; folded: boolean; streetPut: number; handInvested: number }
  >;
  payouts: { seatIndex: number; userId: string; amount: number }[] | null;
  awardedPot?: number | null;
  revealedHoles?: Record<string, readonly [string, string]>;
  fairness?: HoldemPublicFairness;
}
