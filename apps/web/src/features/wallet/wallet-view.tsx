"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  DashboardListSkeleton,
  DashboardPanel,
  DashboardQueryError,
  DashboardSectionHeader,
} from "@/features/dashboards/dashboard-ui";
import { apiBase } from "@/lib/dev-api";
import { formatChips } from "@/lib/format-chips";
import {
  fetchWalletBalance,
  fetchWalletRequests,
  patchWalletCancelRequest,
  postWalletDeposit,
  postWalletWithdrawal,
  type WalletRequestRow,
} from "@/lib/wallet/api-wallet";
import { useAuthActions } from "@/providers/auth-context";

const PAGE = 25;

function statusBadge(s: WalletRequestRow["status"]): string {
  if (s === "PENDING") return "bg-amber-950/90 text-amber-200 ring-1 ring-amber-500/35";
  if (s === "APPROVED") return "bg-emerald-950/90 text-emerald-200 ring-1 ring-emerald-500/35";
  if (s === "REJECTED") return "bg-rose-950/90 text-rose-200 ring-1 ring-rose-500/35";
  return "bg-zinc-800/90 text-zinc-400 ring-1 ring-zinc-600/40";
}

export function WalletView() {
  const queryClient = useQueryClient();
  const { refresh } = useAuthActions();
  const live = Boolean(apiBase());
  const [skip, setSkip] = useState(0);
  const [depAmt, setDepAmt] = useState("");
  const [depNote, setDepNote] = useState("");
  const [wdAmt, setWdAmt] = useState("");
  const [wdNote, setWdNote] = useState("");

  const balQ = useQuery({
    queryKey: ["wallet", "balance"],
    queryFn: fetchWalletBalance,
    enabled: live,
  });

  const listQ = useQuery({
    queryKey: ["wallet", "requests", skip],
    queryFn: () => fetchWalletRequests(skip, PAGE),
    enabled: live,
  });

  const depMut = useMutation({
    mutationFn: async () => {
      const n = Math.floor(Number(depAmt));
      if (!Number.isFinite(n) || n < 1) throw new Error("Enter a valid amount.");
      const row = await postWalletDeposit(n, depNote.trim() || undefined);
      if (!row) throw new Error("Request failed.");
      return row;
    },
    onSuccess: async () => {
      toast.success("Deposit request submitted", { description: "An administrator will review it." });
      setDepAmt("");
      setDepNote("");
      await refresh();
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["lobby"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Could not submit deposit.");
    },
  });

  const wdMut = useMutation({
    mutationFn: async () => {
      const n = Math.floor(Number(wdAmt));
      if (!Number.isFinite(n) || n < 1) throw new Error("Enter a valid amount.");
      const row = await postWalletWithdrawal(n, wdNote.trim() || undefined);
      if (!row) throw new Error("Request failed.");
      return row;
    },
    onSuccess: async () => {
      toast.success("Withdrawal request submitted", { description: "An administrator will review it." });
      setWdAmt("");
      setWdNote("");
      await refresh();
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["lobby"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Could not submit withdrawal.");
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => patchWalletCancelRequest(id),
    onSuccess: async () => {
      toast.success("Request cancelled");
      await refresh();
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["lobby"] });
    },
    onError: () => toast.error("Could not cancel request."),
  });

  if (!live) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-50">Wallet</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Connect the app to your server to use deposits, withdrawals, and balance.
        </p>
        <Link href="/lobby" className="mt-6 inline-block text-sm text-amber-300 underline-offset-4 hover:underline">
          ← Lobby
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-4 pb-28">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Wallet</h1>
          <p className="mt-1 text-sm text-zinc-500">Platform balance and cash movement requests.</p>
        </div>
        <Link href="/profile" className="text-sm font-medium text-amber-300/95 underline-offset-4 hover:underline">
          Profile →
        </Link>
      </header>

      <DashboardPanel>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Available</p>
        {balQ.isPending ? (
          <div className="mt-2 h-10 w-40 animate-pulse rounded-lg bg-zinc-800/80" />
        ) : balQ.isError ? (
          <DashboardQueryError message="Could not load balance." onRetry={() => void balQ.refetch()} />
        ) : (
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-amber-100">
            {formatChips(balQ.data ?? 0)}
          </p>
        )}
      </DashboardPanel>

      <div className="grid gap-4 sm:grid-cols-2">
        <DashboardPanel>
          <DashboardSectionHeader title="Add funds" description="Creates a pending deposit for admin approval." />
          <label className="mt-4 block text-sm text-zinc-300">
            Amount (chips)
            <input
              type="text"
              inputMode="numeric"
              value={depAmt}
              onChange={(e) => setDepAmt(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"
              placeholder="e.g. 5000"
            />
          </label>
          <label className="mt-3 block text-sm text-zinc-300">
            Note (optional)
            <input
              value={depNote}
              onChange={(e) => setDepNote(e.target.value)}
              maxLength={500}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"
            />
          </label>
          <button
            type="button"
            disabled={depMut.isPending}
            onClick={() => depMut.mutate()}
            className="mt-4 w-full rounded-xl bg-emerald-600/90 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {depMut.isPending ? "Submitting…" : "Request deposit"}
          </button>
        </DashboardPanel>

        <DashboardPanel>
          <DashboardSectionHeader
            title="Withdraw"
            description="Creates a pending withdrawal. Balance is checked when you submit and when admin approves."
          />
          <label className="mt-4 block text-sm text-zinc-300">
            Amount (chips)
            <input
              type="text"
              inputMode="numeric"
              value={wdAmt}
              onChange={(e) => setWdAmt(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"
            />
          </label>
          <label className="mt-3 block text-sm text-zinc-300">
            Note (optional)
            <input
              value={wdNote}
              onChange={(e) => setWdNote(e.target.value)}
              maxLength={500}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"
            />
          </label>
          <button
            type="button"
            disabled={wdMut.isPending}
            onClick={() => wdMut.mutate()}
            className="mt-4 w-full rounded-xl border border-rose-500/40 bg-rose-950/35 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-950/50 disabled:opacity-50"
          >
            {wdMut.isPending ? "Submitting…" : "Request withdrawal"}
          </button>
        </DashboardPanel>
      </div>

      <DashboardPanel>
        <DashboardSectionHeader
          title="Activity"
          description="All deposit and withdrawal requests with status and review notes."
          aside={
            listQ.data != null ? (
              <span className="tabular-nums text-zinc-400">{listQ.data.total} total</span>
            ) : null
          }
        />
        {listQ.isPending ? (
          <DashboardListSkeleton rows={6} />
        ) : listQ.isError || !listQ.data ? (
          <DashboardQueryError message="Could not load history." onRetry={() => void listQ.refetch()} />
        ) : listQ.data.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">No requests yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full min-w-[36rem] text-left text-[13px]">
              <thead className="border-b border-white/[0.08] bg-zinc-900/60 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2.5">When</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Details</th>
                  <th className="px-3 py-2.5 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {listQ.data.items.map((r) => (
                  <tr key={r.id} className="bg-zinc-950/20">
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-zinc-400">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-zinc-200">{r.kind === "DEPOSIT" ? "Deposit" : "Withdrawal"}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-zinc-100">
                      {formatChips(r.amount)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="max-w-[14rem] px-3 py-2.5 text-[11px] leading-snug text-zinc-500">
                      {r.memberNote ? <span className="block text-zinc-400">You: {r.memberNote}</span> : null}
                      {r.decidedAt ? (
                        <span className="mt-0.5 block">
                          {r.status === "APPROVED" ? "Approved" : r.status === "REJECTED" ? "Rejected" : "Updated"}{" "}
                          {new Date(r.decidedAt).toLocaleString()}
                        </span>
                      ) : null}
                      {r.adminNote ? <span className="mt-0.5 block text-zinc-400">Admin: {r.adminNote}</span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {r.status === "PENDING" ? (
                        <button
                          type="button"
                          disabled={cancelMut.isPending}
                          onClick={() => {
                            if (typeof window !== "undefined" && window.confirm("Cancel this pending request?")) {
                              cancelMut.mutate(r.id);
                            }
                          }}
                          className="text-[11px] font-semibold text-rose-300 hover:underline"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {listQ.data && listQ.data.total > PAGE ? (
          <div className="mt-4 flex items-center justify-between gap-2 text-sm text-zinc-400">
            <button
              type="button"
              disabled={skip === 0}
              onClick={() => setSkip((s) => Math.max(0, s - PAGE))}
              className="rounded-lg border border-white/10 px-3 py-1.5 font-medium disabled:opacity-40"
            >
              Previous
            </button>
            <span className="tabular-nums">
              {skip + 1}–{Math.min(skip + PAGE, listQ.data.total)} of {listQ.data.total}
            </span>
            <button
              type="button"
              disabled={skip + PAGE >= listQ.data.total}
              onClick={() => setSkip((s) => s + PAGE)}
              className="rounded-lg border border-white/10 px-3 py-1.5 font-medium disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </DashboardPanel>
    </div>
  );
}
