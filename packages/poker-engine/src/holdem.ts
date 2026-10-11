import { fullDeck, shuffle } from "./cards.js";
import { bestScoreFrom7, compareScores } from "./hand-eval.js";

export type HoldemStreet = "preflop" | "flop" | "turn" | "river";
export type HoldemPhase = "betting" | "showdown" | "complete";

export interface HoldemSeatConfig {
  seatIndex: number;
  userId: string;
  stack: number;
}

export interface HoldemPlayerState {
  seatIndex: number;
  userId: string;
  stack: number;
  folded: boolean;
  hole: [string, string];
  streetPut: number;
  handInvested: number;
  respondedBetVersion: number;
  /** After betting equilibrium, pass without raising (NL check-around). */
  checkedPassStreet: boolean;
}

/**
 * Commit/reveal fairness data for one hand.
 * `publicSeed = sha256(privateSeed)` is shown before the deal (the commitment);
 * `privateSeed` stays server-side until the hand is complete, then is revealed so
 * anyone can recompute the hash and rebuild the deck.
 */
export interface HoldemFairness {
  privateSeed: string;
  publicSeed: string;
  nonce: number;
}

export type HoldemPublicFairness = Omit<HoldemFairness, "privateSeed"> & {
  /** Revealed only once `phase` is `complete`. */
  privateSeed?: string;
};

export interface HoldemState {
  handSeq: number;
  phase: HoldemPhase;
  street: HoldemStreet;
  board: string[];
  deck: string[];
  smallBlind: number;
  bigBlind: number;
  buttonSeat: number;
  sbSeat: number;
  bbSeat: number;
  /** Seat indices clockwise from button (index 0 = BTN). */
  order: number[];
  players: HoldemPlayerState[];
  pot: number;
  maxStreetBet: number;
  betVersion: number;
  minRaise: number;
  toActSeat: number | null;
  payouts: { seatIndex: number; userId: string; amount: number }[] | null;
  fairness?: HoldemFairness;
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
  /** Per seat: stack, folded, street chips (this street only). */
  seats: Record<
    string,
    { stack: number; folded: boolean; streetPut: number; handInvested: number }
  >;
  payouts: { seatIndex: number; userId: string; amount: number }[] | null;
  /**
   * Total chips awarded when `phase` is `complete` (sum of `payouts`).
   * The live `pot` field is cleared after payout; use this for post-hand UI.
   * Omitted on older persisted snapshots until the next hand is saved.
   */
  awardedPot?: number | null;
  /**
   * Hole cards shown after the hand ends (showdown / pot awarded).
   * Only seats that were not folded when the hand finished.
   */
  revealedHoles?: Record<string, readonly [string, string]>;
  /** Commit/reveal data for verifying the shuffle; omitted for non-fair hands. */
  fairness?: HoldemPublicFairness;
}

function bySeat(p: HoldemPlayerState[], seat: number): HoldemPlayerState | undefined {
  return p.find((x) => x.seatIndex === seat);
}

function maxStreetBetOf(s: HoldemState): number {
  let m = 0;
  for (const p of s.players) {
    if (!p.folded) m = Math.max(m, p.streetPut);
  }
  return m;
}

function activeCount(s: HoldemState): number {
  return s.players.filter((p) => !p.folded).length;
}

/** First preflop actor seat: HU = SB (BTN), 3+ = seat left of BB (UTG). */
function firstPreflopActorSeat(s: HoldemState): number {
  const n = s.order.length;
  if (n === 2) return s.order[0]!;
  const bbIdx = s.order.indexOf(s.bbSeat);
  return s.order[(bbIdx + 1) % n]!;
}

/** Post-flop: first active left of button. */
function firstPostflopActorSeat(s: HoldemState): number {
  const n = s.order.length;
  const btnIdx = s.order.indexOf(s.buttonSeat);
  for (let k = 1; k <= n; k++) {
    const seat = s.order[(btnIdx + k) % n]!;
    const p = bySeat(s.players, seat);
    if (p && !p.folded) return seat;
  }
  return s.order[0]!;
}

function clearStreet(s: HoldemState): void {
  for (const p of s.players) {
    p.streetPut = 0;
    p.checkedPassStreet = false;
    p.respondedBetVersion = 0;
  }
  s.maxStreetBet = 0;
  s.betVersion = 1;
  s.minRaise = s.bigBlind;
}

function dealBoard(s: HoldemState): void {
  const burn = () => {
    if (s.deck.length) s.deck.pop();
  };
  const take = (n: number) => {
    for (let i = 0; i < n; i++) {
      const c = s.deck.pop();
      if (c) s.board.push(c);
    }
  };
  if (s.street === "flop") {
    burn();
    take(3);
  } else if (s.street === "turn" || s.street === "river") {
    burn();
    take(1);
  }
}

function computeNextToAct(s: HoldemState): number | null {
  if (s.phase !== "betting") return null;
  if (activeCount(s) <= 1) return null;

  const maxB = maxStreetBetOf(s);
  const n = s.order.length;

  // 1) Partial/full calls to match current max: walk in real action order.
  // Preflop starts UTG (seat left of BB); HU = BTN first. Postflop = first active left of button.
  const firstForOwe =
    s.street === "preflop" ? firstPreflopActorSeat(s) : firstPostflopActorSeat(s);
  const oweIdx = s.order.indexOf(firstForOwe);
  const o0 = oweIdx >= 0 ? oweIdx : 0;
  for (let step = 0; step < n; step++) {
    const seat = s.order[(o0 + step) % n]!;
    const p = bySeat(s.players, seat);
    if (!p || p.folded) continue;
    const owe = maxB - p.streetPut;
    if (owe > 0 && p.stack > 0) return seat;
  }

  // 2) respond to current bet level (NL raises reopen action)
  const waveStartIdx =
    s.street === "preflop"
      ? s.order.indexOf(firstPreflopActorSeat(s))
      : s.order.indexOf(firstPostflopActorSeat(s));
  const w0 = waveStartIdx >= 0 ? waveStartIdx : 0;
  for (let step = 0; step < n; step++) {
    const seat = s.order[(w0 + step) % n]!;
    const p = bySeat(s.players, seat);
    if (!p || p.folded || p.stack === 0) continue;
    if (p.streetPut < maxB) continue;
    if (p.respondedBetVersion !== s.betVersion) return seat;
  }

  // 3) check-around for further raises
  const vol = s.players.filter((p) => !p.folded && p.stack > 0);
  if (vol.length === 0) return null;
  if (!vol.every((p) => p.checkedPassStreet)) {
    for (let step = 0; step < n; step++) {
      const seat = s.order[(w0 + step) % n]!;
      const p = bySeat(s.players, seat);
      if (!p || p.folded || p.stack === 0) continue;
      if (!p.checkedPassStreet) return seat;
    }
  }
  return null;
}

function bumpBetVersion(s: HoldemState, aggressorSeat: number): void {
  s.betVersion++;
  s.maxStreetBet = maxStreetBetOf(s);
  for (const p of s.players) {
    p.checkedPassStreet = false;
    if (p.seatIndex !== aggressorSeat) p.respondedBetVersion = 0;
    else p.respondedBetVersion = s.betVersion;
  }
}

function advanceStreetOrFinish(s: HoldemState): void {
  if (activeCount(s) <= 1) {
    const w = s.players.find((p) => !p.folded);
    s.phase = "complete";
    s.toActSeat = null;
    s.payouts = w ? [{ seatIndex: w.seatIndex, userId: w.userId, amount: s.pot }] : [];
    if (w && s.pot > 0) {
      w.stack += s.pot;
      s.pot = 0;
    }
    return;
  }

  if (s.street === "river") {
    showdown(s);
    return;
  }

  s.street =
    s.street === "preflop" ? "flop" : s.street === "flop" ? "turn" : "river";
  clearStreet(s);
  dealBoard(s);
  s.toActSeat = computeNextToAct(s);
}

/**
 * After an action or street change: if nobody can bet (e.g. everyone all-in),
 * keep advancing streets until someone can act or the hand ends.
 */
function settleBettingWhenNoActor(s: HoldemState): void {
  s.toActSeat = computeNextToAct(s);
  while (s.phase === "betting" && s.toActSeat === null) {
    advanceStreetOrFinish(s);
  }
}

function showdown(s: HoldemState): void {
  s.phase = "showdown";
  s.toActSeat = null;
  const board = s.board;
  const contenders = s.players.filter((p) => !p.folded);
  if (contenders.length === 0) {
    s.payouts = [];
    s.phase = "complete";
    return;
  }
  if (contenders.length === 1) {
    s.payouts = [
      {
        seatIndex: contenders[0]!.seatIndex,
        userId: contenders[0]!.userId,
        amount: s.pot,
      },
    ];
    const w0 = contenders[0]!;
    w0.stack += s.pot;
    s.pot = 0;
    s.phase = "complete";
    return;
  }

  /** Best 5-card hand; ties → multiple winners, pot split evenly (+1 chip to low seat indices until remainder gone). */
  let best: number[] | null = null;
  const winners: HoldemPlayerState[] = [];
  for (const p of contenders) {
    const sc = bestScoreFrom7([...p.hole, ...board]);
    if (!best || compareScores(sc, best) > 0) {
      best = sc;
      winners.length = 0;
      winners.push(p);
    } else if (best && compareScores(sc, best) === 0) {
      winners.push(p);
    }
  }
  const share = Math.floor(s.pot / winners.length);
  let rem = s.pot - share * winners.length;
  s.payouts = winners.map((w, i) => ({
    seatIndex: w.seatIndex,
    userId: w.userId,
    amount: share + (i < rem ? 1 : 0),
  }));
  for (const pay of s.payouts) {
    const pl = bySeat(s.players, pay.seatIndex);
    if (pl) pl.stack += pay.amount;
  }
  s.pot = 0;
  s.phase = "complete";
}

function postBlinds(s: HoldemState): void {
  const sbP = bySeat(s.players, s.sbSeat)!;
  const bbP = bySeat(s.players, s.bbSeat)!;
  const sbAmt = Math.min(s.smallBlind, sbP.stack);
  const bbAmt = Math.min(s.bigBlind, bbP.stack);
  sbP.stack -= sbAmt;
  bbP.stack -= bbAmt;
  sbP.streetPut += sbAmt;
  bbP.streetPut += bbAmt;
  sbP.handInvested += sbAmt;
  bbP.handInvested += bbAmt;
  s.pot += sbAmt + bbAmt;
  s.maxStreetBet = Math.max(sbP.streetPut, bbP.streetPut);
  s.betVersion = 1;
  sbP.respondedBetVersion = 0;
  bbP.respondedBetVersion = 0;
  s.minRaise = s.bigBlind;
}

export function startHoldemHand(input: {
  seats: HoldemSeatConfig[];
  buttonSeat: number;
  smallBlind: number;
  bigBlind: number;
  handSeq: number;
  rng?: () => number;
  /** Pre-built 52-card deck (cards dealt via `pop()`). Overrides `rng` when given. */
  deck?: string[];
  fairness?: HoldemFairness;
}): HoldemState {
  const rng = input.rng ?? Math.random;
  const seats = [...input.seats].sort((a, b) => a.seatIndex - b.seatIndex);
  if (seats.length < 2) {
    throw new Error("Hold'em requires at least two players");
  }

  const btnIdx = seats.findIndex((s) => s.seatIndex === input.buttonSeat);
  if (btnIdx < 0) throw new Error("buttonSeat must be occupied");
  const order = [...seats.slice(btnIdx), ...seats.slice(0, btnIdx)].map((s) => s.seatIndex);

  const n = order.length;
  /**
   * Heads-up: dealer posts SB, other posts BB (order[0] is always the button).
   * 3+: SB = seat left of button, BB = next seat clockwise in `order`.
   */
  const sbSeat = n === 2 ? order[0]! : order[1 % n]!;
  const bbSeat = n === 2 ? order[1]! : order[2 % n]!;

  const deck = input.deck ? [...input.deck] : shuffle(fullDeck(), rng);
  if (deck.length !== 52 || new Set(deck).size !== 52) {
    throw new Error("deck must contain 52 unique cards");
  }
  const players: HoldemPlayerState[] = seats.map((sc) => ({
    seatIndex: sc.seatIndex,
    userId: sc.userId,
    stack: sc.stack,
    folded: false,
    hole: ["", ""] as [string, string],
    streetPut: 0,
    handInvested: 0,
    respondedBetVersion: 0,
    checkedPassStreet: false,
  }));

  const dealOrder =
    n === 2 ? [order[0]!, order[1]!] : [...order.slice(1), order[0]!];
  for (let r = 0; r < 2; r++) {
    for (const seat of dealOrder) {
      const p = bySeat(players, seat)!;
      const c = deck.pop();
      if (!c) throw new Error("deck exhausted");
      if (r === 0) p.hole = [c, p.hole[1]];
      else p.hole = [p.hole[0], c];
    }
  }

  const s: HoldemState = {
    handSeq: input.handSeq,
    phase: "betting",
    street: "preflop",
    board: [],
    deck,
    smallBlind: input.smallBlind,
    bigBlind: input.bigBlind,
    buttonSeat: input.buttonSeat,
    sbSeat,
    bbSeat,
    order,
    players,
    pot: 0,
    maxStreetBet: 0,
    betVersion: 1,
    minRaise: input.bigBlind,
    toActSeat: null,
    payouts: null,
    fairness: input.fairness,
  };

  postBlinds(s);
  settleBettingWhenNoActor(s);
  return s;
}

export function holdemPublicSnapshot(s: HoldemState): HoldemPublicSnapshot {
  const seats: HoldemPublicSnapshot["seats"] = {};
  for (const p of s.players) {
    seats[String(p.seatIndex)] = {
      stack: p.stack,
      folded: p.folded,
      streetPut: p.streetPut,
      handInvested: p.handInvested,
    };
  }
  let revealedHoles: HoldemPublicSnapshot["revealedHoles"];
  if (s.phase === "complete" || s.phase === "showdown") {
    revealedHoles = {};
    for (const p of s.players) {
      if (!p.folded) {
        revealedHoles[String(p.seatIndex)] = p.hole;
      }
    }
  }
  const awardedPot =
    s.phase === "complete" && s.payouts != null
      ? s.payouts.reduce((acc, p) => acc + p.amount, 0)
      : null;

  return {
    handSeq: s.handSeq,
    phase: s.phase,
    street: s.street,
    board: s.board,
    pot: s.pot,
    awardedPot,
    maxStreetBet: s.maxStreetBet,
    minRaise: s.minRaise,
    buttonSeat: s.buttonSeat,
    sbSeat: s.sbSeat,
    bbSeat: s.bbSeat,
    toActSeat: s.toActSeat,
    seats,
    payouts: s.payouts,
    revealedHoles,
    fairness: s.fairness && {
      publicSeed: s.fairness.publicSeed,
      nonce: s.fairness.nonce,
      ...(s.phase === "complete" ? { privateSeed: s.fairness.privateSeed } : {}),
    },
  };
}

export function viewerHoleCards(s: HoldemState, seatIndex: number): [string, string] | null {
  const p = bySeat(s.players, seatIndex);
  if (!p) return null;
  return p.hole;
}

export type HoldemClientAction =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  | { type: "bet"; amount: number }
  | { type: "raise_to"; amount: number };

export function applyHoldemAction(
  s: HoldemState,
  seatIndex: number,
  action: HoldemClientAction,
): { ok: true } | { ok: false; error: string } {
  if (s.phase !== "betting") return { ok: false, error: "Hand is not in betting phase." };
  if (s.toActSeat !== seatIndex) return { ok: false, error: "Not your turn." };
  const p = bySeat(s.players, seatIndex);
  if (!p || p.folded) return { ok: false, error: "Player not active." };

  const maxB = maxStreetBetOf(s);
  const toCall = maxB - p.streetPut;

  const markResponded = () => {
    p.respondedBetVersion = s.betVersion;
  };

  if (action.type === "fold") {
    p.folded = true;
    markResponded();
    p.checkedPassStreet = true;
  } else if (action.type === "check") {
    if (toCall > 0) return { ok: false, error: "Cannot check — facing a bet." };
    p.checkedPassStreet = true;
    markResponded();
  } else if (action.type === "call") {
    if (toCall <= 0) return { ok: false, error: "Nothing to call." };
    const pay = Math.min(toCall, p.stack);
    p.stack -= pay;
    p.streetPut += pay;
    p.handInvested += pay;
    s.pot += pay;
    markResponded();
    p.checkedPassStreet = true;
    s.maxStreetBet = maxStreetBetOf(s);
  } else if (action.type === "bet") {
    if (maxB > 0) return { ok: false, error: "There is already a bet — use raise_to." };
    if (action.amount < s.bigBlind) {
      return { ok: false, error: `Minimum bet is big blind (${s.bigBlind}).` };
    }
    if (action.amount > p.stack) return { ok: false, error: "Not enough chips." };
    p.stack -= action.amount;
    p.streetPut += action.amount;
    p.handInvested += action.amount;
    s.pot += action.amount;
    s.minRaise = action.amount;
    bumpBetVersion(s, seatIndex);
    s.maxStreetBet = maxStreetBetOf(s);
  } else if (action.type === "raise_to") {
    const oldMax = maxB;
    if (action.amount <= p.streetPut) {
      return { ok: false, error: "raise_to must increase your street commitment." };
    }
    if (action.amount <= oldMax) {
      return { ok: false, error: "raise_to must exceed the current max bet." };
    }
    const add = action.amount - p.streetPut;
    if (add > p.stack) return { ok: false, error: "Not enough chips to raise_to." };
    const newMax = Math.max(oldMax, action.amount);
    const inc = newMax - oldMax;
    const isShove = add === p.stack;
    if (inc < s.minRaise && !isShove) {
      return { ok: false, error: `Minimum raise increment is ${s.minRaise}.` };
    }
    p.stack -= add;
    p.streetPut += add;
    p.handInvested += add;
    s.pot += add;
    s.minRaise = Math.max(s.bigBlind, inc);
    bumpBetVersion(s, seatIndex);
    s.maxStreetBet = maxStreetBetOf(s);
  }

  settleBettingWhenNoActor(s);

  return { ok: true };
}

/** Fold when leaving the table (even out of turn). */
export function forceFoldPlayer(s: HoldemState, seatIndex: number): void {
  const p = bySeat(s.players, seatIndex);
  if (!p || p.folded) return;
  p.folded = true;
  p.respondedBetVersion = s.betVersion;
  p.checkedPassStreet = true;
  settleBettingWhenNoActor(s);
}

/** Next button seat among occupied seat indices (ascending wrap). */
export function nextButtonSeat(occupiedSorted: readonly number[], currentButton: number): number {
  if (occupiedSorted.length === 0) return currentButton;
  const i = occupiedSorted.indexOf(currentButton);
  if (i < 0) return occupiedSorted[0]!;
  return occupiedSorted[(i + 1) % occupiedSorted.length]!;
}
