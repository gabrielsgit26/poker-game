import { formatChips } from "@/lib/format-chips";
import type { ProfileStats } from "@/lib/profile/types";

const items: {
  key: keyof ProfileStats;
  label: string;
  format: (v: number) => string;
}[] = [
  { key: "handsPlayed", label: "Hands played", format: (v) => String(v) },
  {
    key: "winRatePct",
    label: "Win rate",
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "biggestPotWon",
    label: "Biggest pot won",
    format: (v) => formatChips(v),
  },
  { key: "netChips", label: "Net (all clubs)", format: (v) => formatChips(v) },
];

export function StatsCards({ stats }: { stats: ProfileStats }) {
  return (
    <section aria-labelledby="stats-heading">
      <h2
        id="stats-heading"
        className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500"
      >
        Stats
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {items.map(({ key, label, format }) => (
          <div
            key={key}
            className="rounded-xl border border-white/10 bg-zinc-900/45 px-4 py-3 shadow-md"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              {label}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">
              {format(stats[key])}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
