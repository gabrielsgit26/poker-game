"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { notifyError, notifySuccess } from "@/lib/notifications/notify";
import { UserAvatar } from "@/components/user-avatar";
import {
  DashboardListSkeleton,
  DashboardPanel,
  DashboardQueryError,
  DashboardSectionHeader,
} from "@/features/dashboards/dashboard-ui";
import {
  fetchAdminWalletReportDaily,
  fetchAdminWalletRequests,
  patchAdminWalletRequest,
  type AdminWalletDayApi,
} from "@/lib/admin/api-admin";
import type { WalletRequestRow } from "@/lib/wallet/api-wallet";
import { formatChips } from "@/lib/format-chips";
import { useAuthActions } from "@/providers/auth-context";

const PAGE = 40;

function statusBadge(s: WalletRequestRow["status"]): string {
  if (s === "PENDING") return "bg-amber-950/90 text-amber-200 ring-1 ring-amber-500/35";
  if (s === "APPROVED") return "bg-emerald-950/90 text-emerald-200 ring-1 ring-emerald-500/35";
  if (s === "REJECTED") return "bg-rose-950/90 text-rose-200 ring-1 ring-rose-500/35";
  return "bg-zinc-800/90 text-zinc-400 ring-1 ring-zinc-600/40";
}

export function AdminWalletConsole() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { refresh } = useAuthActions();
  const [skip, setSkip] = useState(0);
  const [status, setStatus] = useState<string>("PENDING");
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [horizon, setHorizon] = useState<7 | 14 | 30>(14);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(qIn.trim()), 300);
    return () => window.clearTimeout(t);
  }, [qIn]);

  useEffect(() => {
    setSkip(0);
  }, [status, q]);

  const listQ = useQuery({
    queryKey: ["admin", "wallet", "requests", skip, status, q],
    queryFn: async () => {
      const r = await fetchAdminWalletRequests(skip, PAGE, status || undefined, q || undefined);
      if (!r) throw new Error("Could not load wallet queue.");
      return r;
    },
  });

  const reportQ = useQuery({
    queryKey: ["admin", "wallet", "report", horizon],
    queryFn: async () => {
      const r = await fetchAdminWalletReportDaily(horizon);
      if (!r) throw new Error("Could not load wallet report.");
      return r;
    },
  });

  const decideMut = useMutation({
    mutationFn: async (p: { id: string; decision: "approve" | "reject" | "cancel" }) => {
      await patchAdminWalletRequest(p.id, p.decision);
    },
    onSuccess: async (_, vars) => {
      const msg =
        vars.decision === "approve"
          ? t("toast.walletApproved")
          : vars.decision === "reject"
            ? t("toast.walletRejected")
            : t("toast.walletCancelled");
      notifySuccess(msg);
      await refresh();
      void queryClient.invalidateQueries({ queryKey: ["admin", "wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      void queryClient.invalidateQueries({ queryKey: ["lobby"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: unknown) => {
      notifyError(e instanceof Error ? e.message : t("toast.walletActionFail"));
    },
  });

  const maxVol = useMemo(() => {
    const days = reportQ.data?.days ?? [];
    if (!days.length) return 1;
    return Math.max(1, ...days.map((d) => Math.max(d.depositSum, d.withdrawalSum, d.approvedCount * 100)));
  }, [reportQ.data]);

  return (
    <div className="space-y-8">
      <DashboardPanel>
        <DashboardSectionHeader
          title="Wallet requests"
          description="Approve or reject player deposits and withdrawals. Cancel duplicates or mistakes."
          aside={
            listQ.data != null ? (
              <span className="tabular-nums text-zinc-400">{listQ.data.total} rows</span>
            ) : null
          }
        />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(["PENDING", "APPROVED", "REJECTED", "CANCELLED", ""] as const).map((s) => (
            <button
              key={s || "all"}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                (s === "" && status === "") || s === status
                  ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/35"
                  : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300"
              }`}
            >
              {s === "" ? "All" : s}
            </button>
          ))}
        </div>
        <input
          value={qIn}
          onChange={(e) => setQIn(e.target.value)}
          placeholder="Filter by user id…"
          className="mt-3 w-full max-w-md rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        {listQ.isPending ? (
          <DashboardListSkeleton rows={5} />
        ) : listQ.isError ? (
          <DashboardQueryError message={(listQ.error as Error)?.message ?? "Error"} onRetry={() => void listQ.refetch()} />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full min-w-[44rem] text-left text-[13px]">
              <thead className="border-b border-white/[0.08] bg-zinc-900/60 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2.5">Created</th>
                  <th className="px-3 py-2.5">User</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {listQ.data!.items.map((r) => (
                  <tr key={r.id} className="bg-zinc-950/20">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-zinc-400">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-0 max-w-[14rem] items-center gap-2">
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-zinc-800 ring-1 ring-white/10">
                          <UserAvatar
                            photoUrl={r.telegramPhotoUrl}
                            fallbackEmoji={r.userId.slice(0, 2).toUpperCase()}
                            label={r.userId}
                            className="h-full w-full font-mono text-[10px] font-bold text-zinc-300"
                          />
                        </div>
                        <span className="truncate font-mono text-[11px] text-zinc-300">{r.userId}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-zinc-200">{r.kind === "DEPOSIT" ? "Deposit" : "Withdrawal"}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-zinc-100">{formatChips(r.amount)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.status === "PENDING" ? (
                        <div className="flex flex-wrap justify-end gap-1">
                          <button
                            type="button"
                            disabled={decideMut.isPending}
                            onClick={() => decideMut.mutate({ id: r.id, decision: "approve" })}
                            className="rounded-md bg-emerald-600/85 px-2 py-1 text-[11px] font-semibold text-white"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={decideMut.isPending}
                            onClick={() => decideMut.mutate({ id: r.id, decision: "reject" })}
                            className="rounded-md border border-white/15 px-2 py-1 text-[11px] font-semibold text-zinc-200"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            disabled={decideMut.isPending}
                            onClick={() => decideMut.mutate({ id: r.id, decision: "cancel" })}
                            className="rounded-md text-[11px] font-semibold text-rose-300 hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {listQ.data && listQ.data.total > PAGE ? (
          <div className="mt-3 flex justify-between text-sm text-zinc-500">
            <button
              type="button"
              disabled={skip === 0}
              onClick={() => setSkip((s) => Math.max(0, s - PAGE))}
              className="font-medium disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={skip + PAGE >= listQ.data.total}
              onClick={() => setSkip((s) => s + PAGE)}
              className="font-medium disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </DashboardPanel>

      <DashboardPanel>
        <DashboardSectionHeader
          title="Wallet report (UTC)"
          description="Approved deposit and withdrawal totals by day."
          aside={
            <div className="flex gap-1">
              {([7, 14, 30] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setHorizon(d)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                    horizon === d ? "bg-violet-500/25 text-violet-100 ring-1 ring-violet-500/35" : "text-zinc-500"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          }
        />
        {reportQ.isPending ? (
          <DashboardListSkeleton rows={4} />
        ) : reportQ.isError ? (
          <DashboardQueryError message="Could not load report." onRetry={() => void reportQ.refetch()} />
        ) : (
          <div className="mt-4 space-y-2">
            <p className="text-[11px] text-zinc-500">
              Range {reportQ.data!.rangeStart} → {reportQ.data!.rangeEnd} · {reportQ.data!.pendingCount} pending platform-wide
            </p>
            <div className="flex flex-wrap gap-4 border-b border-white/[0.06] pb-2 text-[11px] text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-emerald-500/80" aria-hidden />
                Deposits
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-rose-500/80" aria-hidden />
                Withdrawals
              </span>
            </div>
            <ul className="space-y-2">
              {(reportQ.data!.days as AdminWalletDayApi[]).map((day) => (
                <li key={day.day} className="flex items-center gap-3 text-[12px]">
                  <span className="w-24 shrink-0 font-mono text-zinc-500">{day.day}</span>
                  <div className="flex min-w-0 flex-1 gap-1">
                    <div
                      className="h-6 rounded-md bg-emerald-500/55"
                      style={{ width: `${Math.max(6, (day.depositSum / maxVol) * 100)}%` }}
                      title={`Deposits ${day.depositSum}`}
                    />
                    <div
                      className="h-6 rounded-md bg-rose-500/50"
                      style={{ width: `${Math.max(6, (day.withdrawalSum / maxVol) * 100)}%` }}
                      title={`Withdrawals ${day.withdrawalSum}`}
                    />
                  </div>
                  <span className="shrink-0 tabular-nums text-zinc-400">
                    {day.approvedCount} tx
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}
