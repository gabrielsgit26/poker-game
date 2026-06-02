import { formatChips } from "@/lib/format-chips";
import type { ClubBalanceRow } from "@/lib/profile/types";

export function ClubBalances({ rows }: { rows: ClubBalanceRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="club-bal-heading">
      <h2
        id="club-bal-heading"
        className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500"
      >
        Club balances
      </h2>
      <ul className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.map((r) => (
          <li
            key={r.clubId}
            className="min-w-[10.5rem] shrink-0 rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-3"
          >
            <p className="truncate text-xs font-medium text-zinc-300">
              {r.clubName}
            </p>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-amber-100">
              {formatChips(r.chips)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
