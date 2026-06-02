/** Rank A=14 … 2=2 */
export function rankOf(card: string): number {
  const r = card[0];
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
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
