function suitColor(suit: string): string {
  return suit === "h" || suit === "d" ? "text-rose-400" : "text-zinc-200";
}

export function CardFace({ code }: { code: string }) {
  const rank = code.slice(0, 1);
  const suit = code.slice(1);
  const sym =
    suit === "h" ? "♥" : suit === "d" ? "♦" : suit === "c" ? "♣" : "♠";
  return (
    <span
      className={`inline-flex min-w-[2.75rem] flex-col items-center rounded-lg border border-white/15 bg-zinc-900/90 px-2 py-1.5 font-mono text-sm font-semibold shadow-inner ${suitColor(suit)}`}
    >
      <span className="leading-none">{rank === "T" ? "10" : rank}</span>
      <span className="text-xs leading-none opacity-90">{sym}</span>
    </span>
  );
}
