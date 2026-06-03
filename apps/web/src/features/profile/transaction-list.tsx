"use client";

import { formatChips } from "@/lib/format-chips";
import type { TxRow } from "@/lib/profile/types";

/** Rows per page — must match `GET /profile/transactions?limit=`. */
export const PROFILE_TX_PAGE_SIZE = 12;

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

export type TransactionListProps = {
  rows: TxRow[];
  total: number;
  skip: number;
  limit: number;
  isPending?: boolean;
  /** True while refetching (e.g. page change); disables pager without clearing rows. */
  isFetching?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  onSkipChange: (nextSkip: number) => void;
};

export function TransactionList({
  rows,
  total,
  skip,
  limit,
  isPending,
  isFetching,
  isError,
  errorMessage,
  onRetry,
  onSkipChange,
}: TransactionListProps) {
  const navBusy = Boolean(isPending || isFetching);
  const showPager = total > limit;
  const rangeStart = rows.length === 0 ? 0 : skip + 1;
  const rangeEnd = rows.length === 0 ? 0 : skip + rows.length;

  return (
    <section aria-labelledby="tx-heading">
      <h2
        id="tx-heading"
        className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500"
      >
        Transaction history
      </h2>
      {isError ? (
        <div className="rounded-xl border border-rose-500/25 bg-rose-950/20 p-4 text-center text-sm text-rose-200/90">
          <p>Could not load transactions.</p>
          {errorMessage ? (
            <p className="mt-1 text-xs text-rose-300/70">{errorMessage}</p>
          ) : null}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-lg border border-white/15 bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : total === 0 && !isPending ? (
        <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-zinc-500">
          No transactions yet.
        </p>
      ) : (
        <>
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
                {isPending && rows.length === 0
                  ? Array.from({ length: limit }, (_, i) => (
                      <tr key={`sk-${i}`} className="animate-pulse">
                        <td className="px-3 py-2.5">
                          <div className="h-4 w-24 rounded bg-white/10" />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="h-4 w-16 rounded bg-white/10" />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="h-4 w-20 rounded bg-white/10" />
                        </td>
                        <td className="hidden px-3 py-2.5 sm:table-cell">
                          <div className="h-4 w-28 rounded bg-white/10" />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="ml-auto h-4 w-14 rounded bg-white/10" />
                        </td>
                      </tr>
                    ))
                  : rows.map((tx) => (
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
          {showPager ? (
            <div className="mt-3 flex items-center justify-between gap-2 text-sm text-zinc-400">
              <button
                type="button"
                disabled={skip === 0 || navBusy}
                onClick={() => onSkipChange(Math.max(0, skip - limit))}
                className="rounded-lg border border-white/10 px-3 py-1.5 font-medium text-zinc-200 transition hover:bg-white/5 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="tabular-nums text-xs sm:text-sm">
                {total === 0 ? "0" : `${rangeStart}–${rangeEnd}`} of {total}
              </span>
              <button
                type="button"
                disabled={skip + limit >= total || navBusy}
                onClick={() => onSkipChange(skip + limit)}
                className="rounded-lg border border-white/10 px-3 py-1.5 font-medium text-zinc-200 transition hover:bg-white/5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
