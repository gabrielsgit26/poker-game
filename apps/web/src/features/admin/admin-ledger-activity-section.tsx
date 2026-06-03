"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DashboardQueryError, DashboardSectionHeader } from "@/features/dashboards/dashboard-ui";
import { fetchAdminLedgerReport } from "@/lib/admin/api-admin";

const HORIZONS = [7, 14, 30] as const;

function barPct(value: number, max: number): number {
  if (value <= 0) return 0;
  if (max <= 0) return 0;
  const raw = (value / max) * 100;
  return Math.max(8, Math.min(100, Math.round(raw)));
}

export function AdminLedgerActivitySection() {
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(14);

  const q = useQuery({
    queryKey: ["admin", "report", "ledger-daily", horizon],
    queryFn: async () => {
      const r = await fetchAdminLedgerReport(horizon);
      if (!r) throw new Error("Could not load ledger activity.");
      return r;
    },
  });

  const maxEntries = useMemo(() => {
    if (!q.data?.days.length) return 1;
    return Math.max(1, ...q.data.days.map((d) => d.entries));
  }, [q.data]);

  const maxAbsNet = useMemo(() => {
    if (!q.data?.days.length) return 1;
    return Math.max(1, ...q.data.days.map((d) => Math.abs(d.netDelta)));
  }, [q.data]);

  const summary = useMemo(() => {
    if (!q.data) return "";
    let e = 0;
    let net = 0;
    for (const d of q.data.days) {
      e += d.entries;
      net += d.netDelta;
    }
    return `${e.toLocaleString()} ledger rows · net ${net >= 0 ? "+" : ""}${net.toLocaleString()} chips`;
  }, [q.data]);

  return (
    <section className="mt-10 border-t border-white/[0.06] pt-8" aria-label="Ledger activity">
      <DashboardSectionHeader
        title="Chip ledger activity (UTC)"
        description="Daily entry count and net chip delta across all clubs (audit trail)."
        aside={
          <div className="flex flex-wrap gap-1" role="group" aria-label="Date range">
            {HORIZONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setHorizon(d)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  horizon === d
                    ? "bg-violet-500/20 text-violet-100 ring-1 ring-violet-500/35"
                    : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        }
      />

      {q.isError ? (
        <DashboardQueryError
          message={q.error instanceof Error ? q.error.message : "Failed to load ledger report."}
          onRetry={() => void q.refetch()}
        />
      ) : q.isPending || !q.data ? (
        <div className="mt-3 h-36 animate-pulse rounded-xl border border-white/[0.05] bg-zinc-900/40" />
      ) : (
        <>
          <p className="mb-3 text-[11px] leading-relaxed text-zinc-600">{summary}</p>
          <div className="flex flex-wrap items-center gap-4 border-b border-white/[0.06] pb-2 text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-violet-500/80" aria-hidden />
              Entries / day
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-teal-500/80" aria-hidden />
              |Net Δ| scale
            </span>
          </div>
          <div
            className="mt-2 overflow-x-auto pb-1"
            role="img"
            aria-label={`Ledger bars ${q.data.rangeStart} to ${q.data.rangeEnd}. ${summary}`}
          >
            <div className="flex min-w-[min(100%,28rem)] items-end gap-px sm:gap-0.5" style={{ height: "7.5rem" }}>
              {q.data.days.map((d) => {
                const he = barPct(d.entries, maxEntries);
                const hn = barPct(Math.abs(d.netDelta), maxAbsNet);
                const label = d.day.slice(5);
                return (
                  <div
                    key={d.day}
                    className="flex min-w-0 flex-1 flex-col items-center justify-end"
                    title={`${d.day}: ${d.entries} entries, net ${d.netDelta >= 0 ? "+" : ""}${d.netDelta} chips`}
                  >
                    <div className="flex h-28 w-full items-end justify-center gap-0.5 px-px">
                      <div
                        className="w-[42%] max-w-[14px] rounded-t bg-violet-500/70 transition hover:bg-violet-400/85"
                        style={{ height: `${he}%` }}
                      />
                      <div
                        className="w-[42%] max-w-[14px] rounded-t bg-teal-500/65 transition hover:bg-teal-400/85"
                        style={{ height: `${hn}%` }}
                      />
                    </div>
                    <span className="mt-1 w-full truncate text-center text-[9px] font-medium tabular-nums text-zinc-600 sm:text-[10px]">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-[10px] text-zinc-600">
            Range {q.data.rangeStart} → {q.data.rangeEnd} (UTC).
          </p>
        </>
      )}
    </section>
  );
}
