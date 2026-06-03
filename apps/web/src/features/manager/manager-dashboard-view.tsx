"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  fetchCashOutRequests,
  fetchClubDetail,
  fetchClubsList,
} from "@/lib/lobby/api-clubs";

export function ManagerDashboardView() {
  const { data: clubs, isPending } = useQuery({
    queryKey: ["lobby", "clubs-for-manager"],
    queryFn: async () => (await fetchClubsList()) ?? [],
  });

  const managed = useMemo(
    () =>
      (clubs ?? []).filter(
        (c) =>
          c.membership === "JOINED" &&
          (c.viewerRole === "OWNER" || c.viewerRole === "MANAGER"),
      ),
    [clubs],
  );

  const detailQueries = useQueries({
    queries: managed.map((c) => ({
      queryKey: ["club", c.id],
      queryFn: () => fetchClubDetail(c.id),
      enabled: managed.length > 0,
    })),
  });

  const cashOutQueries = useQueries({
    queries: managed.map((c) => ({
      queryKey: ["club", c.id, "cash-out-requests"],
      queryFn: () => fetchCashOutRequests(c.id),
      enabled: managed.length > 0,
    })),
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-lg animate-pulse px-4 py-8">
        <div className="h-8 w-1/2 rounded bg-zinc-800" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-amber-400/90">Clubs</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-50">Manager dashboard</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Plan §6.7 — open a club for join requests, cash-outs, chip adjustments, and full ledger.
        </p>
      </div>

      {managed.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-6 text-sm text-zinc-400">
          You are not an owner or manager of any club yet. Create a club from the lobby or ask an
          owner to promote you.
        </p>
      ) : (
        <ul className="space-y-3">
          {managed.map((c, i) => {
            const detail = detailQueries[i]?.data;
            const cashRows = cashOutQueries[i]?.data ?? [];
            const pendingJoin = detail?.pendingRequests?.length ?? 0;
            const pendingCash = cashRows.filter((r) => r.status === "PENDING").length;
            const members = detail?.members?.length ?? c.memberCount;
            return (
              <li key={c.id}>
                <Link
                  href={`/clubs/${encodeURIComponent(c.id)}`}
                  className="block rounded-2xl border border-white/10 bg-zinc-900/40 p-4 transition hover:border-amber-500/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-zinc-100">{c.name}</p>
                      <p className="mt-0.5 text-[11px] font-mono text-zinc-500">{c.id}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                      {c.viewerRole}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="rounded-lg bg-black/25 px-2 py-2">
                      <dt className="text-zinc-500">Members</dt>
                      <dd className="font-semibold tabular-nums text-zinc-200">{members}</dd>
                    </div>
                    <div className="rounded-lg bg-black/25 px-2 py-2">
                      <dt className="text-zinc-500">Join pending</dt>
                      <dd className="font-semibold tabular-nums text-amber-200/90">{pendingJoin}</dd>
                    </div>
                    <div className="rounded-lg bg-black/25 px-2 py-2">
                      <dt className="text-zinc-500">Cash-out pend.</dt>
                      <dd className="font-semibold tabular-nums text-rose-200/90">{pendingCash}</dd>
                    </div>
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/lobby" className="text-sm text-amber-300 underline-offset-4 hover:underline">
        ← Lobby
      </Link>
    </div>
  );
}
