/** Rank A=14 … 2=2 */
export function rankOf(card: string): number {
  const r = card[0]!;
  if (r === "A") return 14;
  if (r === "K") return 13;
  if (r === "Q") return 12;
  if (r === "J") return 11;
  if (r === "T") return 10;
  return parseInt(r, 10);
}

export function suitOf(card: string): string {
  return card.slice(1);
}

export function fullDeck(): string[] {
  const ranks = "23456789TJQKA".split("");
  const suits = ["c", "d", "h", "s"] as const;
  const out: string[] = [];
  for (const s of suits) {
    for (const r of ranks) {
      out.push(`${r}${s}`);
    }
  }
  return out;
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  return shuffleWith(items, (max) => Math.floor(rng() * max));
}

/**
 * Fisher–Yates driven by a uniform integer source in [0, max).
 * Deterministic for a deterministic source, so anyone holding the revealed seed
 * can rebuild the identical deck and verify the deal.
 */
export function shuffleWith<T>(items: T[], randomInt: (max: number) => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
