"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DashboardEmptyState,
  DashboardFooterNav,
  DashboardListSkeleton,
  DashboardPageShell,
  DashboardPagination,
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
  fetchManagerClubChipTotals,
  patchCashOutRequest,
  patchJoinRequest,
} from "@/lib/lobby/api-clubs";
import { fetchTablesList, isApiRequestError } from "@/lib/lobby/api-tables";
import { formatChips } from "@/lib/format-chips";
import type { TableCardModel } from "@/lib/lobby/types";

type ManagerTab = "overview" | "requests" | "clubs" | "tables";

const TABLES_PAGE_SIZE = 25;

function tableStatusClass(s: TableCardModel["playStatus"]): string {
  if (s === "PLAYING") return "bg-emerald-950/90 text-emerald-200 ring-1 ring-emerald-500/35";
  if (s === "FULL") return "bg-sky-950/90 text-sky-200 ring-1 ring-sky-500/35";
  return "bg-zinc-800/90 text-zinc-300 ring-1 ring-zinc-600/45";
}

function isPendingJoinRow(r: { status: string }): boolean {
  return r.status === "PENDING" || r.status === "pending";
}

export function ManagerDashboardView() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ManagerTab>("overview");
  const [tablesSkip, setTablesSkip] = useState(0);

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

  const chipTotalsQ = useQuery({
    queryKey: ["manager", "chip-totals"],
    queryFn: async () => (await fetchManagerClubChipTotals()) ?? [],
    enabled: managed.length > 0,
  });

  const managedTables = useMemo(() => {
    const all = tablesQ.data ?? [];
    return all.filter((t) => managedIds.has(t.clubId));
  }, [tablesQ.data, managedIds]);

  const pagedManagedTables = useMemo(
    () => managedTables.slice(tablesSkip, tablesSkip + TABLES_PAGE_SIZE),
    [managedTables, tablesSkip],
  );

  useEffect(() => {
    const len = managedTables.length;
    if (len === 0) {
      setTablesSkip(0);
      return;
    }
    if (tablesSkip >= len) {
      const lastSkip = Math.max(0, (Math.ceil(len / TABLES_PAGE_SIZE) - 1) * TABLES_PAGE_SIZE);
      setTablesSkip(lastSkip);
    }
  }, [managedTables, tablesSkip]);

  const overview = useMemo(() => {
    let pendingJoin = 0;
    let pendingCash = 0;
    let members = 0;
    managed.forEach((c, i) => {
      const d = detailQueries[i]?.data;
      const cash = cashOutQueries[i]?.data;
      pendingJoin += (d?.pendingRequests ?? []).filter(isPendingJoinRow).length;
      pendingCash += (cash ?? []).filter((r) => r.status === "PENDING").length;
      members += d?.members?.length ?? c.memberCount ?? 0;
    });
    const liveTables = managedTables.filter((t) => t.playStatus === "PLAYING" || t.playStatus === "FULL").length;
    const circulating =
      chipTotalsQ.data != null
        ? chipTotalsQ.data.reduce((acc, row) => acc + (row.totalMemberChips ?? 0), 0)
        : null;
    const loading =
      managed.length > 0 &&
      (detailQueries.some((q, i) => i < managed.length && q.isPending) ||
        cashOutQueries.some((q, i) => i < managed.length && q.isPending) ||
        chipTotalsQ.isPending);
    return {
      clubCount: managed.length,
      pendingJoin,
      pendingCash,
      members,
      liveTables,
      circulating,
      chipTotalsPending: chipTotalsQ.isPending,
      chipTotalsError: chipTotalsQ.isError,
      loading,
    };
  }, [
    managed,
    detailQueries,
    cashOutQueries,
    managedTables,
    chipTotalsQ.isPending,
    chipTotalsQ.isError,
    chipTotalsQ.data,
  ]);

  const workQueue = useMemo(() => {
    type JoinItem = {
      kind: "join";
      clubId: string;
      clubName: string;
      requestId: string;
      userId: string;
    };
    type CashItem = {
      kind: "cashout";
      clubId: string;
      clubName: string;
      requestId: string;
      userId: string;
      amount: number;
      createdAt: string;
    };
    const joins: JoinItem[] = [];
    const cashouts: CashItem[] = [];
    managed.forEach((c, i) => {
      const d = detailQueries[i]?.data;
      const cash = cashOutQueries[i]?.data ?? [];
      for (const pr of d?.pendingRequests ?? []) {
        if (!isPendingJoinRow(pr)) continue;
        joins.push({
          kind: "join",
          clubId: c.id,
          clubName: c.name,
          requestId: pr.id,
          userId: pr.userId,
        });
      }
      for (const r of cash) {
        if (r.status !== "PENDING") continue;
        cashouts.push({
          kind: "cashout",
          clubId: c.id,
          clubName: c.name,
          requestId: r.id,
          userId: r.userId,
          amount: r.amount,
          createdAt: r.createdAt,
        });
      }
    });
    joins.sort((a, b) => a.clubName.localeCompare(b.clubName));
    cashouts.sort((a, b) => a.clubName.localeCompare(b.clubName) || b.createdAt.localeCompare(a.createdAt));
    return { joins, cashouts };
  }, [managed, detailQueries, cashOutQueries]);

  const invalidateManagerData = () => {
    void queryClient.invalidateQueries({ queryKey: ["club"] });
    void queryClient.invalidateQueries({ queryKey: ["lobby", "clubs-for-manager"] });
    void queryClient.invalidateQueries({ queryKey: ["manager", "chip-totals"] });
    void queryClient.invalidateQueries({ queryKey: ["manager", "tables"] });
  };

  const decideJoinMut = useMutation({
    mutationFn: async (p: { clubId: string; requestId: string; approve: boolean }) => {
      const ok = await patchJoinRequest(p.clubId, p.requestId, p.approve);
      if (!ok) throw new Error("Server rejected the decision.");
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.approve ? "Join request approved" : "Join request rejected");
      invalidateManagerData();
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Could not update join request.");
    },
  });

  const decideCashMut = useMutation({
    mutationFn: async (p: { clubId: string; requestId: string; approve: boolean }) => {
      const ok = await patchCashOutRequest(p.clubId, p.requestId, p.approve);
      if (!ok) throw new Error("Server rejected the decision.");
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.approve ? "Cash-out approved" : "Cash-out rejected");
      invalidateManagerData();
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Could not update cash-out request.");
    },
  });

  const joinBusy = (clubId: string, requestId: string) =>
    decideJoinMut.isPending &&
    decideJoinMut.variables?.clubId === clubId &&
    decideJoinMut.variables?.requestId === requestId;

  const cashBusy = (clubId: string, requestId: string) =>
    decideCashMut.isPending &&
    decideCashMut.variables?.clubId === clubId &&
    decideCashMut.variables?.requestId === requestId;

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
        label: "Circulating chips",
        value: overview.chipTotalsPending ? "…" : overview.chipTotalsError ? "—" : (overview.circulating ?? 0),
        hint: overview.chipTotalsError
          ? "Chip totals request failed; retry from the club page if needed."
          : "Sum of active member balances across your managed clubs (server).",
        tone: "default" as const,
      },
      {
        label: "Live tables",
        value: overview.liveTables,
        hint: "PLAYING or FULL tables under your clubs (lobby snapshot).",
        tone: overview.liveTables > 0 ? ("emerald" as const) : ("default" as const),
      },
      {
        label: "Join requests",
        value: overview.pendingJoin,
        hint: "Awaiting approval — use the Requests tab.",
        tone: overview.pendingJoin > 0 ? ("amber" as const) : ("default" as const),
      },
      {
        label: "Cash-out queue",
        value: overview.pendingCash,
        hint: "PENDING payout requests.",
        tone: overview.pendingCash > 0 ? ("rose" as const) : ("default" as const),
      },
    ],
    [
      overview.clubCount,
      overview.members,
      overview.circulating,
      overview.chipTotalsPending,
      overview.chipTotalsError,
      overview.liveTables,
      overview.pendingJoin,
      overview.pendingCash,
    ],
  );

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-14 sm:px-6">
        <div className="h-3 w-28 animate-pulse rounded bg-zinc-800" />
        <div className="h-9 max-w-md animate-pulse rounded-lg bg-zinc-800" />
        <div className="h-28 animate-pulse rounded-2xl bg-zinc-900/50" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
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
          <span className="font-medium text-zinc-400">MANAGER</span>. Use{" "}
          <span className="font-medium text-zinc-400">Requests</span> for join and cash-out decisions; open a club
          for ledger and member tools; use Tables for live rooms.
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
          id="mgr-tab-requests"
          aria-controls="mgr-panel-requests"
          active={tab === "requests"}
          onClick={() => setTab("requests")}
          badge={overview.pendingJoin + overview.pendingCash}
        >
          Requests
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
          <StatMetricGrid metrics={overviewMetrics} gridClassName="grid-cols-2 lg:grid-cols-3" />
          <p className="mt-6 border-t border-white/[0.06] pt-5 text-[12px] leading-relaxed text-zinc-600">
            <span className="font-medium text-zinc-500">Requests</span> is the fastest path for pending join and
            cash-out items. <span className="font-medium text-zinc-500">Clubs</span> opens each venue;{" "}
            <span className="font-medium text-zinc-500">Tables</span> lists lobby rows for your clubs only.
          </p>
        </DashboardPanel>
      ) : tab === "requests" ? (
        <DashboardPanel id="mgr-panel-requests" role="tabpanel" aria-labelledby="mgr-tab-requests">
          <DashboardSectionHeader
            title="Approvals queue"
            description="Each action calls the server with the same rules as the club workspace. Approve only when treasury and membership checks are satisfied."
            aside={
              <span className="tabular-nums text-zinc-400">
                {overview.pendingJoin + overview.pendingCash} open
              </span>
            }
          />
          {overview.loading && workQueue.joins.length === 0 && workQueue.cashouts.length === 0 ? (
            <DashboardListSkeleton rows={5} />
          ) : workQueue.joins.length === 0 && workQueue.cashouts.length === 0 ? (
            <DashboardEmptyState
              title="Queue is clear"
              description="There are no pending join or cash-out requests across your managed clubs right now."
            />
          ) : (
            <div className="space-y-8">
              {workQueue.joins.length > 0 ? (
                <section aria-labelledby="mgr-req-join-heading">
                  <h3 id="mgr-req-join-heading" className="mb-3 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                    Join requests
                  </h3>
                  <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.07] bg-zinc-900/20">
                    {workQueue.joins.map((j) => (
                      <li key={`join-${j.clubId}-${j.requestId}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-zinc-100">
                            <Link
                              href={`/clubs/${encodeURIComponent(j.clubId)}`}
                              className="text-amber-400/95 underline-offset-2 hover:underline"
                            >
                              {j.clubName}
                            </Link>
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-zinc-500">User {j.userId}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={joinBusy(j.clubId, j.requestId)}
                            onClick={() => decideJoinMut.mutate({ clubId: j.clubId, requestId: j.requestId, approve: true })}
                            className="rounded-lg bg-emerald-600/90 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {joinBusy(j.clubId, j.requestId) ? "…" : "Approve"}
                          </button>
                          <button
                            type="button"
                            disabled={joinBusy(j.clubId, j.requestId)}
                            onClick={() => decideJoinMut.mutate({ clubId: j.clubId, requestId: j.requestId, approve: false })}
                            className="rounded-lg border border-white/[0.12] bg-zinc-900/60 px-3 py-2 text-[12px] font-semibold text-zinc-200 transition hover:bg-zinc-800/80 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Reject
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {workQueue.cashouts.length > 0 ? (
                <section aria-labelledby="mgr-req-cash-heading">
                  <h3 id="mgr-req-cash-heading" className="mb-3 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                    Cash-out requests
                  </h3>
                  <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.07] bg-zinc-900/20">
                    {workQueue.cashouts.map((row) => (
                      <li
                        key={`cash-${row.clubId}-${row.requestId}`}
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                      >
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-zinc-100">
                            <Link
                              href={`/clubs/${encodeURIComponent(row.clubId)}`}
                              className="text-amber-400/95 underline-offset-2 hover:underline"
                            >
                              {row.clubName}
                            </Link>
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-zinc-500">User {row.userId}</p>
                          <p className="mt-1 text-[13px] font-semibold tabular-nums text-rose-200/90">
                            {formatChips(row.amount)} requested
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={cashBusy(row.clubId, row.requestId)}
                            onClick={() =>
                              decideCashMut.mutate({ clubId: row.clubId, requestId: row.requestId, approve: true })
                            }
                            className="rounded-lg bg-emerald-600/90 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {cashBusy(row.clubId, row.requestId) ? "…" : "Approve"}
                          </button>
                          <button
                            type="button"
                            disabled={cashBusy(row.clubId, row.requestId)}
                            onClick={() =>
                              decideCashMut.mutate({ clubId: row.clubId, requestId: row.requestId, approve: false })
                            }
                            className="rounded-lg border border-white/[0.12] bg-zinc-900/60 px-3 py-2 text-[12px] font-semibold text-zinc-200 transition hover:bg-zinc-800/80 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Reject
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
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
              const pendingJoin = (detail?.pendingRequests ?? []).filter(isPendingJoinRow).length;
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
            <>
            <ul className="max-h-[min(60vh,28rem)] divide-y divide-white/[0.05] overflow-y-auto overscroll-contain rounded-xl border border-white/[0.06] bg-zinc-900/25 [-webkit-overflow-scrolling:touch]">
              {pagedManagedTables.map((t) => (
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
            <DashboardPagination
              skip={tablesSkip}
              limit={TABLES_PAGE_SIZE}
              total={managedTables.length}
              noun="tables"
              onSkipChange={setTablesSkip}
            />
            </>
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
