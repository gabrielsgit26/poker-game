import { formatChips } from "@/lib/format-chips";
import type { TxRow } from "@/lib/profile/types";

function formatType(t: string): string {
  return t.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function TransactionList({ rows }: { rows: TxRow[] }) {
  return (
    <section aria-labelledby="tx-heading">
      <h2
        id="tx-heading"
        className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500"
      >
        Transaction history
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-zinc-500">
          No transactions yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead className="border-b border-white/10 bg-zinc-900/80 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Club</th>
                <th className="hidden px-3 py-2 sm:table-cell">Date</th>
                <th className="px-3 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-zinc-950/40">
              {rows.map((tx) => (
                <tr key={tx.id} className="text-zinc-300">
                  <td className="px-3 py-2.5">{formatType(tx.type)}</td>
                  <td
                    className={`px-3 py-2.5 font-mono tabular-nums ${
                      tx.amount >= 0 ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {tx.amount >= 0 ? "+" : ""}
                    {formatChips(tx.amount)}
                  </td>
                  <td className="max-w-[7rem] truncate px-3 py-2.5 text-zinc-400">
                    {tx.clubName ?? "—"}
                  </td>
                  <td className="hidden px-3 py-2.5 text-xs text-zinc-500 sm:table-cell">
                    {formatWhen(tx.at)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-zinc-400">
                    {tx.balanceAfter != null ? formatChips(tx.balanceAfter) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
