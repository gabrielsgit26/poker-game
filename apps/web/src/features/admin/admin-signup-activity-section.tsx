"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DashboardQueryError, DashboardSectionHeader } from "@/features/dashboards/dashboard-ui";
import { fetchAdminSignupReport } from "@/lib/admin/api-admin";

const HORIZONS = [7, 14, 30] as const;

function pct(value: number, max: number): number {
  if (value <= 0) return 0;
  if (max <= 0) return 0;
  const raw = (value / max) * 100;
  return Math.max(8, Math.min(100, Math.round(raw)));
}

export function AdminSignupActivitySection() {
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(14);

  const q = useQuery({
    queryKey: ["admin", "report", "signups", horizon],
    queryFn: async () => {
      const r = await fetchAdminSignupReport(horizon);
      if (!r) throw new Error("Could not load signup activity.");
      return r;
    },
  });

  const maxVal = useMemo(() => {
    if (!q.data?.days.length) return 1;
    return Math.max(1, ...q.data.days.flatMap((d) => [d.newUsers, d.newClubs]));
  }, [q.data]);

  const summary = useMemo(() => {
    if (!q.data) return "";
    let u = 0;
    let c = 0;
    for (const d of q.data.days) {
      u += d.newUsers;
      c += d.newClubs;
    }
    return `Totals in range: ${u} new users, ${c} new clubs.`;
  }, [q.data]);

  return (
    <section className="mt-8 border-t border-white/[0.06] pt-6" aria-label="Signup activity">
      <DashboardSectionHeader
        title="New signups by day (UTC)"
        description="From Mongo `createdAt` on user and club documents. Use for growth trends, not financial reporting."
        aside={
          <div className="flex flex-wrap gap-1" role="group" aria-label="Date range">
            {HORIZONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setHorizon(d)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  horizon === d
                    ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/35"
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
          message={q.error instanceof Error ? q.error.message : "Failed to load activity."}
          onRetry={() => void q.refetch()}
        />
      ) : q.isPending || !q.data ? (
        <div className="mt-3 h-36 animate-pulse rounded-xl border border-white/[0.05] bg-zinc-900/40" />
      ) : (
        <>
          <p className="mb-3 text-[11px] leading-relaxed text-zinc-600">{summary}</p>
          <div className="flex flex-wrap items-center gap-4 border-b border-white/[0.06] pb-2 text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-amber-500/80" aria-hidden />
              Users
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-zinc-500/90" aria-hidden />
              Clubs
            </span>
          </div>
          <div
            className="mt-2 overflow-x-auto pb-1"
            role="img"
            aria-label={`Bar chart of daily signups from ${q.data.rangeStart} to ${q.data.rangeEnd}. ${summary}`}
          >
            <div className="flex min-w-[min(100%,28rem)] items-end gap-px sm:gap-0.5" style={{ height: "7.5rem" }}>
              {q.data.days.map((d) => {
                const hu = pct(d.newUsers, maxVal);
                const hc = pct(d.newClubs, maxVal);
                const label = d.day.slice(5);
                return (
                  <div
                    key={d.day}
                    className="flex min-w-0 flex-1 flex-col items-center justify-end"
                    title={`${d.day}: +${d.newUsers} users, +${d.newClubs} clubs`}
                  >
                    <div className="flex h-28 w-full items-end justify-center gap-0.5 px-px">
                      <div
                        className="w-[42%] max-w-[14px] rounded-t bg-amber-500/75 transition hover:bg-amber-400/90"
                        style={{ height: `${hu}%` }}
                      />
                      <div
                        className="w-[42%] max-w-[14px] rounded-t bg-zinc-500/70 transition hover:bg-zinc-400/85"
                        style={{ height: `${hc}%` }}
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
