import { rankOf, suitOf } from "./cards.js";

/** Lexicographic: positive if a > b */
export function compareScores(a: readonly number[], b: readonly number[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function combinations5(cards: readonly string[]): string[][] {
  const n = cards.length;
  const res: string[][] = [];
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++)
            res.push([cards[a]!, cards[b]!, cards[c]!, cards[d]!, cards[e]!]);
  return res;
}

/** Category 8 straight flush … 0 high card, then tie-breakers descending */
export function scoreFiveCards(cards: readonly [string, string, string, string, string]): number[] {
  const ranks = cards.map(rankOf).sort((x, y) => y - x);
  const suits = cards.map(suitOf);
  const flush = suits.every((s) => s === suits[0]);

  const uniq = [...new Set(ranks)].sort((x, y) => y - x);
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);

  const byCount = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const isWheel =
    uniq.length === 5 &&
    uniq[0] === 14 &&
    uniq[1] === 5 &&
    uniq[2] === 4 &&
    uniq[3] === 3 &&
    uniq[4] === 2;

  const straightHigh = (() => {
    if (uniq.length !== 5) return null;
    if (isWheel) return 5;
    for (let i = 0; i < uniq.length - 1; i++) {
      if (uniq[i]! - uniq[i + 1]! !== 1) return null;
    }
    return uniq[0];
  })();

  const straight = straightHigh !== null;

  if (flush && straight) {
    return [8, straightHigh!];
  }

  if (byCount[0]![1] === 4) {
    const quad = byCount[0]![0];
    const kicker = byCount[1]![0];
    return [7, quad, kicker];
  }

  if (byCount[0]![1] === 3 && byCount[1]![1] === 2) {
    return [6, byCount[0]![0], byCount[1]![0]];
  }

  if (flush) {
    return [5, ...ranks];
  }

  if (straight) {
    return [4, straightHigh!];
  }

  if (byCount[0]![1] === 3) {
    const t = byCount[0]![0];
    const kickers = byCount.slice(1).map((x) => x[0]).sort((a, b) => b - a);
    return [3, t, ...kickers];
  }

  if (byCount[0]![1] === 2 && byCount[1]![1] === 2) {
    const hi = Math.max(byCount[0]![0], byCount[1]![0]);
    const lo = Math.min(byCount[0]![0], byCount[1]![0]);
    const kicker = byCount[2]![0];
    return [2, hi, lo, kicker];
  }

  if (byCount[0]![1] === 2) {
    const p = byCount[0]![0];
    const kickers = byCount.slice(1).map((x) => x[0]).sort((a, b) => b - a);
    return [1, p, ...kickers];
  }

  return [0, ...ranks];
}

export function bestScoreFrom7(cards7: readonly string[]): number[] {
  let best: number[] | null = null;
  for (const five of combinations5([...cards7])) {
    const s = scoreFiveCards(five as [string, string, string, string, string]);
    if (!best || compareScores(s, best) > 0) best = s;
  }
  return best!;
}

const CAT = [
  "High card",
  "Pair",
  "Two pair",
  "Trips",
  "Straight",
  "Flush",
  "Full house",
  "Quads",
  "Straight flush",
];

function rankName(n: number): string {
  if (n === 14) return "Ace";
  if (n === 13) return "King";
  if (n === 12) return "Queen";
  if (n === 11) return "Jack";
  if (n === 10) return "Ten";
  return String(n);
}

export function describeScore(score: readonly number[]): string {
  const c = score[0]!;
  const name = CAT[c] ?? "Hand";
  if (c === 8 || c === 4) return `${name} (${rankName(score[1]!)} high)`;
  if (c === 7) return `${name} (${rankName(score[1]!)}s)`;
  if (c === 6) return `${name} (${rankName(score[1]!)} full of ${rankName(score[2]!)})`;
  if (c === 5) return `${name} (${rankName(score[1]!)} high)`;
  if (c === 3) return `${name} (${rankName(score[1]!)}s)`;
  if (c === 2) return `${name} (${rankName(score[1]!)} and ${rankName(score[2]!)})`;
  if (c === 1) return `${name} (${rankName(score[1]!)}s)`;
  return `${name} (${rankName(score[1]!)} high)`;
}
