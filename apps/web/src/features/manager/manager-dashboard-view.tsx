"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  DashboardEmptyState,
  DashboardFooterNav,
  DashboardListSkeleton,
  DashboardPageShell,
  DashboardPanel,
  DashboardQueryError,
  DashboardSectionHeader,
  DashboardTabButton,
  DashboardTabList,
  StatMetricGrid,
  dashboardFooterLinkClass,
} from "@/features/dashboards/dashboard-ui";
import {
  fetchCashOutRequests,
  fetchClubDetail,
  fetchClubsList,
} from "@/lib/lobby/api-clubs";
import { fetchTablesList, isApiRequestError } from "@/lib/lobby/api-tables";
import { formatChips } from "@/lib/format-chips";
import type { TableCardModel } from "@/lib/lobby/types";

type ManagerTab = "overview" | "clubs" | "tables";

function tableStatusClass(s: TableCardModel["playStatus"]): string {
  if (s === "PLAYING") return "bg-emerald-950/90 text-emerald-200 ring-1 ring-emerald-500/35";
  if (s === "FULL") return "bg-sky-950/90 text-sky-200 ring-1 ring-sky-500/35";
  return "bg-zinc-800/90 text-zinc-300 ring-1 ring-zinc-600/45";
}

export function ManagerDashboardView() {
  const [tab, setTab] = useState<ManagerTab>("overview");

  const { data: clubs, isPending, isError, error, refetch } = useQuery({
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

  const managedIds = useMemo(() => new Set(managed.map((c) => c.id)), [managed]);

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

  const tablesQ = useQuery({
    queryKey: ["manager", "tables"],
    queryFn: () => fetchTablesList(),
    enabled: managed.length > 0,
  });

  const managedTables = useMemo(() => {
    const all = tablesQ.data ?? [];
    return all.filter((t) => managedIds.has(t.clubId));
  }, [tablesQ.data, managedIds]);

  const overview = useMemo(() => {
    let pendingJoin = 0;
    let pendingCash = 0;
    let members = 0;
    managed.forEach((c, i) => {
      const d = detailQueries[i]?.data;
      const cash = cashOutQueries[i]?.data;
      pendingJoin += d?.pendingRequests?.length ?? 0;
      pendingCash += (cash ?? []).filter((r) => r.status === "PENDING").length;
      members += d?.members?.length ?? c.memberCount ?? 0;
    });
    const loading =
      managed.length > 0 &&
      (detailQueries.some((q, i) => i < managed.length && q.isPending) ||
        cashOutQueries.some((q, i) => i < managed.length && q.isPending));
    return {
      clubCount: managed.length,
      pendingJoin,
      pendingCash,
      members,
      loading,
    };
  }, [managed, detailQueries, cashOutQueries]);

  const overviewMetrics = useMemo(
    () => [
      {
        label: "Clubs you run",
        value: overview.clubCount,
        hint: "Joined as owner or manager.",
        tone: "amber" as const,
      },
      {
        label: "Members (est.)",
        value: overview.members,
        hint: "Detail payload when loaded; else lobby count.",
        tone: "default" as const,
      },
      {
        label: "Join requests",
        value: overview.pendingJoin,
        hint: "Awaiting approval across clubs.",
        tone: overview.pendingJoin > 0 ? ("amber" as const) : ("default" as const),
      },
      {
        label: "Cash-out queue",
        value: overview.pendingCash,
        hint: "PENDING payout requests.",
        tone: overview.pendingCash > 0 ? ("rose" as const) : ("default" as const),
      },
    ],
    [overview.clubCount, overview.members, overview.pendingJoin, overview.pendingCash],
  );

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-14 sm:px-6">
        <div className="h-3 w-28 animate-pulse rounded bg-zinc-800" />
        <div className="h-9 max-w-md animate-pulse rounded-lg bg-zinc-800" />
        <div className="h-28 animate-pulse rounded-2xl bg-zinc-900/50" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[118px] animate-pulse rounded-xl bg-zinc-900/40" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <DashboardQueryError
          message={
            isApiRequestError(error)
              ? error.message
              : error instanceof Error
                ? error.message
                : "Could not load clubs."
          }
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <DashboardPageShell
      eyebrow="Club operations"
      title="Manager console"
      description={
        <>
          Cross-club snapshot for venues where you are{" "}
          <span className="font-medium text-zinc-400">OWNER</span> or{" "}
          <span className="font-medium text-zinc-400">MANAGER</span> (plan §6.7). Open a club for approvals and
          treasury tools; use Tables to enter live rooms.
        </>
      }
    >
      <DashboardTabList aria-label="Manager console sections">
        <DashboardTabButton
          id="mgr-tab-overview"
          aria-controls="mgr-panel-overview"
          active={tab === "overview"}
          onClick={() => setTab("overview")}
        >
          Overview
        </DashboardTabButton>
        <DashboardTabButton
          id="mgr-tab-clubs"
          aria-controls="mgr-panel-clubs"
          active={tab === "clubs"}
          onClick={() => setTab("clubs")}
          badge={managed.length}
        >
          Clubs
        </DashboardTabButton>
        <DashboardTabButton
          id="mgr-tab-tables"
          aria-controls="mgr-panel-tables"
          active={tab === "tables"}
          onClick={() => setTab("tables")}
          badge={managedTables.length}
        >
          Tables
        </DashboardTabButton>
      </DashboardTabList>

      {managed.length === 0 ? (
        <DashboardPanel>
          <DashboardEmptyState
            title="No clubs under your management"
            description="Create a club from the lobby or ask an owner to grant manager access. This console will then show metrics, shortcuts, and tables for those venues."
          >
            <Link
              href="/lobby"
              className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-5 py-2.5 text-[13px] font-semibold text-zinc-950 transition hover:bg-amber-400"
            >
              Open lobby
            </Link>
          </DashboardEmptyState>
        </DashboardPanel>
      ) : tab === "overview" ? (
        <DashboardPanel id="mgr-panel-overview" role="tabpanel" aria-labelledby="mgr-tab-overview">
          {overview.loading ? (
            <p className="mb-4 flex items-center gap-2 text-[12px] font-medium text-zinc-500">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400/90" />
              Syncing per-club figures…
            </p>
          ) : null}
          <StatMetricGrid metrics={overviewMetrics} />
          <p className="mt-6 border-t border-white/[0.06] pt-5 text-[12px] leading-relaxed text-zinc-600">
            <span className="font-medium text-zinc-500">Clubs</span> lists each venue with live counters.{" "}
            <span className="font-medium text-zinc-500">Tables</span> is filtered from the platform table list to
            your clubs only.
          </p>
        </DashboardPanel>
      ) : tab === "clubs" ? (
        <DashboardPanel id="mgr-panel-clubs" role="tabpanel" aria-labelledby="mgr-tab-clubs">
          <DashboardSectionHeader
            title="Your clubs"
            description="Counts pull from club detail and cash-out APIs. Select a card to open the full club workspace."
            aside={<span className="tabular-nums text-zinc-400">{managed.length} clubs</span>}
          />
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
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-zinc-900/50 to-zinc-950/80 p-4 transition hover:border-amber-500/25 hover:shadow-md hover:shadow-black/20 sm:p-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[15px] font-semibold text-zinc-50">{c.name}</p>
                        <span className="shrink-0 rounded-md border border-white/[0.08] bg-black/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200/90">
                          {c.viewerRole}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-mono text-[11px] text-zinc-500">{c.id}</p>
                      <dl className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-white/[0.06] bg-black/25 px-2 py-2.5 text-center">
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Members
                          </dt>
                          <dd className="mt-1 text-[15px] font-semibold tabular-nums text-zinc-100">{members}</dd>
                        </div>
                        <div className="rounded-xl border border-white/[0.06] bg-black/25 px-2 py-2.5 text-center">
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Join
                          </dt>
                          <dd className="mt-1 text-[15px] font-semibold tabular-nums text-amber-200/95">
                            {pendingJoin}
                          </dd>
                        </div>
                        <div className="rounded-xl border border-white/[0.06] bg-black/25 px-2 py-2.5 text-center">
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Cash-out
                          </dt>
                          <dd className="mt-1 text-[15px] font-semibold tabular-nums text-rose-200/95">
                            {pendingCash}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <span
                      className="shrink-0 text-lg text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-400"
                      aria-hidden
                    >
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </DashboardPanel>
      ) : (
        <DashboardPanel id="mgr-panel-tables" role="tabpanel" aria-labelledby="mgr-tab-tables">
          <DashboardSectionHeader
            title="Live tables"
            description="Subset of the global tables list: only tables whose club id is in your managed set."
            aside={
              !tablesQ.isPending && tablesQ.data ? (
                <span className="tabular-nums text-zinc-400">{managedTables.length} tables</span>
              ) : null
            }
          />
          {tablesQ.isError ? (
            <DashboardQueryError
              message={
                isApiRequestError(tablesQ.error)
                  ? tablesQ.error.message
                  : tablesQ.error instanceof Error
                    ? tablesQ.error.message
                    : "Failed to load tables."
              }
              onRetry={() => void tablesQ.refetch()}
            />
          ) : tablesQ.isPending ? (
            <DashboardListSkeleton rows={6} />
          ) : managedTables.length === 0 ? (
            <DashboardEmptyState
              title="No active listings"
              description="When players create tables under your clubs, they appear here with stakes, buy-in, and occupancy."
            />
          ) : (
            <ul className="max-h-[min(60vh,28rem)] divide-y divide-white/[0.05] overflow-y-auto overscroll-contain rounded-xl border border-white/[0.06] bg-zinc-900/25 [-webkit-overflow-scrolling:touch]">
              {managedTables.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/tables/${encodeURIComponent(t.id)}`}
                    className="group flex min-h-[4.25rem] items-center justify-between gap-4 px-4 py-3.5 transition hover:bg-white/[0.04] sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-zinc-100">{t.name}</p>
                      <p className="mt-1 truncate text-[11px] text-zinc-500">
                        <span className="text-zinc-400">{t.clubName}</span>
                        <span className="text-zinc-600"> · </span>
                        {t.smallBlind}/{t.bigBlind} blinds
                        <span className="text-zinc-600"> · </span>
                        Min {formatChips(t.minBuyIn)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${tableStatusClass(t.playStatus)}`}
                        >
                          {t.playStatus}
                        </span>
                        <p className="mt-1 text-[11px] font-medium tabular-nums text-zinc-500">
                          {t.players}/{t.maxPlayers} seated
                        </p>
                      </div>
                      <span
                        className="text-lg text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-emerald-400/90"
                        aria-hidden
                      >
                        →
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>
      )}

      <DashboardFooterNav>
        <Link href="/lobby" className={dashboardFooterLinkClass("primary")}>
          Lobby
        </Link>
        <Link href="/profile" className={dashboardFooterLinkClass("ghost")}>
          Profile
        </Link>
      </DashboardFooterNav>
    </DashboardPageShell>
  );
}
