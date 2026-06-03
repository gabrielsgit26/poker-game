"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { notifyError, notifySuccess } from "@/lib/notifications/notify";
import {
  type ChipLedgerApiRow,
  fetchCashOutRequests,
  fetchClubChipLedger,
  fetchClubDetail,
  patchCashOutRequest,
  patchJoinRequest,
  postCashOutRequest,
  postJoinClub,
  postManagerChipAdjustment,
} from "@/lib/lobby/api-clubs";
import { formatChips } from "@/lib/format-chips";
import { useAuthActions } from "@/providers/auth-context";

function csvEscape(s: string): string {
  return `"${String(s).replace(/"/g, '""')}"`;
}

function downloadClubLedgerCsv(rows: ChipLedgerApiRow[], filenameBase: string) {
  const head = ["createdAt", "userId", "kind", "delta", "balanceAfter", "tableId", "note"];
  const lines = [head.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.createdAt),
        csvEscape(r.userId),
        csvEscape(r.kind),
        csvEscape(String(r.delta)),
        csvEscape(String(r.balanceAfter)),
        csvEscape(r.tableId ?? ""),
        csvEscape(r.note ?? ""),
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  const safe = filenameBase.replace(/[^\w.-]+/g, "_").slice(0, 80) || "club";
  a.href = URL.createObjectURL(blob);
  a.download = `${safe}-chip-ledger.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function chipKindLabel(kind: string): string {
  switch (kind) {
    case "BUYIN_DEBIT":
      return "Buy-in (table)";
    case "CASHOUT_CREDIT":
      return "Cash-out (seat)";
    case "BUYIN_ROLLBACK":
      return "Buy-in rollback";
    case "MANAGER_ADJUST":
      return "Manager adjustment";
    case "MEMBER_CASHOUT":
      return "Cash-out (club wallet)";
    case "PLATFORM_ADJUST":
      return "Platform adjustment";
    default:
      return kind;
  }
}

export function ClubDetailView({ clubId }: { clubId: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { refresh } = useAuthActions();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["club", clubId],
    queryFn: async () => {
      const d = await fetchClubDetail(clubId);
      if (!d) throw new Error("offline");
      return d;
    },
    retry: false,
  });

  const ledgerScope: "me" | "club" = useMemo(() => {
    if (!data || data.membership !== "JOINED") return "me";
    return data.viewerRole === "OWNER" || data.viewerRole === "MANAGER" ? "club" : "me";
  }, [data]);

  const { data: ledger, isPending: ledgerPending } = useQuery({
    queryKey: ["club", clubId, "chip-ledger", ledgerScope],
    queryFn: async () => (await fetchClubChipLedger(clubId, ledgerScope)) ?? [],
    enabled: data?.membership === "JOINED",
  });

  const { data: cashOutRows = [], isPending: cashOutPending } = useQuery({
    queryKey: ["club", clubId, "cash-out-requests"],
    queryFn: async () => (await fetchCashOutRequests(clubId)) ?? [],
    enabled: data?.membership === "JOINED",
  });

  const adjustableMembers = useMemo(() => {
    if (!data) return [];
    const can = data.viewerRole === "OWNER" || data.viewerRole === "MANAGER";
    if (!can) return [];
    if (data.viewerRole === "OWNER") return data.members;
    return data.members.filter((m) => m.role === "MEMBER");
  }, [data]);

  const [adjustTarget, setAdjustTarget] = useState("");
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [cashOutAmount, setCashOutAmount] = useState("");
  const [cashOutNote, setCashOutNote] = useState("");

  useEffect(() => {
    if (!adjustableMembers.length) return;
    setAdjustTarget((t) =>
      adjustableMembers.some((m) => m.userId === t) ? t : adjustableMembers[0]!.userId,
    );
  }, [adjustableMembers]);

  const joinMut = useMutation({
    mutationFn: () => postJoinClub(clubId),
    onSuccess: (result) => {
      if (result) {
        void queryClient.invalidateQueries({ queryKey: ["club", clubId] });
        void queryClient.invalidateQueries({ queryKey: ["club", clubId, "chip-ledger"] });
        void queryClient.invalidateQueries({ queryKey: ["club", clubId, "cash-out-requests"] });
        void queryClient.invalidateQueries({ queryKey: ["lobby"] });
      }
    },
  });

  const decideMut = useMutation({
    mutationFn: async ({
      requestId,
      approve,
    }: {
      requestId: string;
      approve: boolean;
    }) => {
      const ok = await patchJoinRequest(clubId, requestId, approve);
      if (!ok) throw new Error("failed");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["club", clubId] });
      void queryClient.invalidateQueries({ queryKey: ["club", clubId, "chip-ledger"] });
      void queryClient.invalidateQueries({ queryKey: ["lobby"] });
    },
  });

  const adjustMut = useMutation({
    mutationFn: async (p: { targetUserId: string; delta: number; note?: string }) => {
      const r = await postManagerChipAdjustment(clubId, p.targetUserId, {
        delta: p.delta,
        note: p.note,
      });
      if (!r) throw new Error("API is not configured.");
      return r;
    },
    onSuccess: (r) => {
      notifySuccess(t("toast.balanceUpdated"), {
        description: t("toast.balanceAdjustDesc")
          .replace("{{user}}", r.targetUserId)
          .replace("{{balance}}", formatChips(r.newBalance)),
      });
      setAdjustDelta("");
      setAdjustNote("");
      void queryClient.invalidateQueries({ queryKey: ["club", clubId] });
      void queryClient.invalidateQueries({ queryKey: ["club", clubId, "chip-ledger"] });
    },
    onError: (e: unknown) => {
      notifyError(e instanceof Error ? e.message : t("toast.adjustFail"));
    },
  });

  const cashOutMut = useMutation({
    mutationFn: async (p: { amount: number; memberNote?: string }) => {
      const r = await postCashOutRequest(clubId, p);
      if (!r) throw new Error("API is not configured.");
      return r;
    },
    onSuccess: () => {
      notifySuccess(t("toast.cashOutSubmitted"), {
        description: t("toast.cashOutSubmittedDescManager"),
      });
      setCashOutAmount("");
      setCashOutNote("");
      void queryClient.invalidateQueries({ queryKey: ["club", clubId] });
      void queryClient.invalidateQueries({ queryKey: ["club", clubId, "cash-out-requests"] });
    },
    onError: (e: unknown) => {
      notifyError(e instanceof Error ? e.message : t("toast.cashOutFail"));
    },
  });

  const decideCashOutMut = useMutation({
    mutationFn: async (p: { requestId: string; approve: boolean }) => {
      const ok = await patchCashOutRequest(clubId, p.requestId, p.approve);
      if (!ok) throw new Error("Unable to update that request.");
    },
    onSuccess: () => {
      notifySuccess(t("toast.cashOutUpdated"));
      void refresh();
      void queryClient.invalidateQueries({ queryKey: ["lobby"] });
      void queryClient.invalidateQueries({ queryKey: ["club", clubId] });
      void queryClient.invalidateQueries({ queryKey: ["club", clubId, "chip-ledger"] });
      void queryClient.invalidateQueries({ queryKey: ["club", clubId, "cash-out-requests"] });
    },
    onError: (e: unknown) => {
      notifyError(e instanceof Error ? e.message : t("toast.cashOutActionFail"));
    },
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-lg animate-pulse space-y-4 px-4 py-8">
        <div className="h-8 w-2/3 rounded bg-zinc-800" />
        <div className="h-24 rounded-xl bg-zinc-800/70" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-zinc-300">Could not load club details.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-zinc-950"
        >
          Retry
        </button>
        <Link
          href="/lobby"
          className="mt-6 block text-sm text-amber-300 underline-offset-4 hover:underline"
        >
          ← Back to lobby
        </Link>
      </div>
    );
  }

  const { club, membership, viewerRole, members, pendingRequests, viewerClubChipBalance } =
    data;
  const canManage = viewerRole === "OWNER" || viewerRole === "MANAGER";
  const showMemberColumn = ledgerScope === "club";

  const joinLabel =
    club.isPrivate && membership !== "JOINED" ? "Request to join" : "Join club";

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-amber-400/90">Club</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-50">{club.name}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {club.memberCount} members
          {club.isPrivate ? " · Private" : " · Public"}
          {viewerRole ? ` · Your role: ${viewerRole}` : null}
        </p>
        {membership === "JOINED" && viewerClubChipBalance != null ? (
          <p className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100/95">
            <span className="text-zinc-500">Club wallet (off-table)</span>
            <span className="ml-2 font-bold tabular-nums text-emerald-200">
              {formatChips(viewerClubChipBalance)} chips
            </span>
          </p>
        ) : null}
      </div>

      {membership !== "JOINED" && membership !== "PENDING" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={joinMut.isPending}
            onClick={() => joinMut.mutate()}
            className="rounded-xl bg-amber-500/90 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
          >
            {joinMut.isPending ? "Working…" : joinLabel}
          </button>
        </div>
      ) : null}

      {membership === "PENDING" ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
          Your join request is pending manager approval.
        </p>
      ) : null}

      {membership === "JOINED" ? (
        <section aria-labelledby="ledger-h" className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2
              id="ledger-h"
              className="text-xs font-medium uppercase tracking-widest text-zinc-500"
            >
              Chip activity
              {ledgerScope === "club" ? (
                <span className="ml-2 font-normal normal-case text-zinc-600">(club-wide)</span>
              ) : null}
            </h2>
            {ledgerScope === "club" && ledger && ledger.length > 0 ? (
              <button
                type="button"
                onClick={() => downloadClubLedgerCsv(ledger, club.name)}
                className="shrink-0 rounded-lg border border-white/15 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-white/5"
              >
                Export CSV
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
            {ledgerScope === "club"
              ? "Recent wallet movements for all members (owners/managers)."
              : "Your buy-ins when a hand starts, cash-outs when you leave a seat, and any manager credits."}
          </p>
          {ledgerPending ? (
            <p className="mt-3 text-sm text-zinc-500">Loading activity…</p>
          ) : ledger && ledger.length > 0 ? (
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {ledger.map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-zinc-200">{chipKindLabel(row.kind)}</span>
                    <span
                      className={
                        row.delta >= 0 ? "font-semibold text-emerald-300" : "font-semibold text-rose-300"
                      }
                    >
                      {row.delta >= 0 ? "+" : ""}
                      {formatChips(row.delta)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-zinc-500">
                    {showMemberColumn ? (
                      <span className="font-mono text-zinc-400">{row.userId}</span>
                    ) : null}
                    <time dateTime={row.createdAt}>
                      {new Date(row.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    <span>Balance {formatChips(row.balanceAfter)}</span>
                    {row.tableId ? (
                      <Link
                        href={`/tables/${encodeURIComponent(row.tableId)}`}
                        className="text-amber-400/90 underline-offset-2 hover:underline"
                      >
                        Table
                      </Link>
                    ) : null}
                  </div>
                  {row.note ? <p className="mt-0.5 text-[10px] text-zinc-600">{row.note}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              No movements yet. Play a hand, take a seat, or use manager tools below.
            </p>
          )}
        </section>
      ) : null}

      {membership === "JOINED" ? (
        <section
          aria-labelledby="cashout-h"
          className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4"
        >
          <h2
            id="cashout-h"
            className="text-xs font-medium uppercase tracking-widest text-zinc-500"
          >
            Club wallet cash-out
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
            Request a debit from your <strong className="text-zinc-400">off-table</strong> club
            chips. A manager approves or rejects; approved amounts appear in chip activity as a
            club-wallet cash-out line.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="min-w-[8rem] flex-1 text-sm text-zinc-300">
              Amount
              <input
                type="number"
                min={1}
                value={cashOutAmount}
                onChange={(e) => setCashOutAmount(e.target.value)}
                placeholder="Chips to remove"
                className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
              />
            </label>
            <label className="min-w-[10rem] flex-[2] text-sm text-zinc-300">
              Note (optional)
              <input
                value={cashOutNote}
                onChange={(e) => setCashOutNote(e.target.value)}
                maxLength={200}
                placeholder="e.g. settle with host"
                className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={
              cashOutMut.isPending ||
              !cashOutAmount.trim() ||
              Number.isNaN(parseInt(cashOutAmount, 10)) ||
              parseInt(cashOutAmount, 10) < 1
            }
            onClick={() => {
              const n = parseInt(cashOutAmount, 10);
              if (n < 1) {
                notifyError(t("toast.enterPositive"));
                return;
              }
              cashOutMut.mutate({
                amount: n,
                memberNote: cashOutNote.trim() || undefined,
              });
            }}
            className="mt-3 w-full rounded-xl border border-white/15 bg-zinc-800/80 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
          >
            {cashOutMut.isPending ? "Submitting…" : "Submit cash-out request"}
          </button>

          {cashOutPending ? (
            <p className="mt-4 text-sm text-zinc-500">Loading requests…</p>
          ) : cashOutRows.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {cashOutRows.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-mono text-zinc-300">{r.userId}</span>
                    <span className="font-semibold text-rose-200/90">
                      −{formatChips(r.amount)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-zinc-500">
                    <span className="uppercase tracking-wide text-zinc-400">{r.status}</span>
                    <time dateTime={r.createdAt}>
                      {new Date(r.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    {r.decidedAt ? (
                      <span>
                        Decided{" "}
                        {new Date(r.decidedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    ) : null}
                  </div>
                  {r.memberNote ? (
                    <p className="mt-0.5 text-[10px] text-zinc-600">Member: {r.memberNote}</p>
                  ) : null}
                  {canManage && r.status === "PENDING" ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={decideCashOutMut.isPending}
                        onClick={() =>
                          decideCashOutMut.mutate({ requestId: r.id, approve: true })
                        }
                        className="rounded-lg bg-emerald-600/90 px-3 py-1 text-[11px] font-semibold text-white"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={decideCashOutMut.isPending}
                        onClick={() =>
                          decideCashOutMut.mutate({ requestId: r.id, approve: false })
                        }
                        className="rounded-lg border border-white/15 px-3 py-1 text-[11px] font-semibold text-zinc-300"
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">No cash-out requests yet.</p>
          )}
        </section>
      ) : null}

      {members.length > 0 ? (
        <section aria-labelledby="members-h">
          <h2
            id="members-h"
            className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-500"
          >
            Members
          </h2>
          <ul className="divide-y divide-white/10 rounded-xl border border-white/10 bg-zinc-900/40">
            {members.map((m) => (
              <li
                key={`${m.userId}-${m.role}`}
                className="flex justify-between px-4 py-2.5 text-sm"
              >
                <span className="font-mono text-zinc-200">{m.userId}</span>
                <span className="text-zinc-500">{m.role}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-zinc-500">
          {club.isPrivate && membership !== "JOINED"
            ? "Member list is visible after you join."
            : "No members loaded."}
        </p>
      )}

      {canManage && adjustableMembers.length > 0 ? (
        <section
          aria-labelledby="adjust-h"
          className="rounded-2xl border border-amber-500/25 bg-amber-950/15 p-4"
        >
          <h2
            id="adjust-h"
            className="text-xs font-medium uppercase tracking-widest text-amber-200/90"
          >
            Manager · chip adjustment
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
            Credit or debit a member&apos;s <strong className="text-zinc-400">club wallet</strong>{" "}
            (off-table). Logged as MANAGER_ADJUST. Managers may only change{" "}
            <strong className="text-zinc-400">MEMBER</strong> balances.
          </p>
          <div className="mt-3 space-y-3">
            <label className="block text-sm text-zinc-300">
              Member
              <select
                value={adjustTarget}
                onChange={(e) => setAdjustTarget(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
              >
                {adjustableMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.userId} ({m.role})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-zinc-300">
              Delta (chips)
              <input
                type="number"
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(e.target.value)}
                placeholder="e.g. 5000 or -1000"
                className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
              />
            </label>
            <label className="block text-sm text-zinc-300">
              Note (optional)
              <input
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                maxLength={200}
                placeholder="Reason for records"
                className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
            </label>
            <button
              type="button"
              disabled={
                adjustMut.isPending ||
                !adjustTarget ||
                !adjustDelta.trim() ||
                Number.isNaN(parseInt(adjustDelta, 10))
              }
              onClick={() => {
                const n = parseInt(adjustDelta, 10);
                if (n === 0) {
                  notifyError(t("toast.deltaNonZero"));
                  return;
                }
                adjustMut.mutate({
                  targetUserId: adjustTarget,
                  delta: n,
                  note: adjustNote.trim() || undefined,
                });
              }}
              className="w-full rounded-xl bg-amber-500/90 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50"
            >
              {adjustMut.isPending ? "Applying…" : "Apply adjustment"}
            </button>
          </div>
        </section>
      ) : null}

      {canManage && pendingRequests.length > 0 ? (
        <section aria-labelledby="req-h">
          <h2
            id="req-h"
            className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-500"
          >
            Pending join requests
          </h2>
          <ul className="space-y-2">
            {pendingRequests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-zinc-900/50 px-4 py-3"
              >
                <span className="font-mono text-sm text-zinc-200">{r.userId}</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={decideMut.isPending}
                    onClick={() => decideMut.mutate({ requestId: r.id, approve: true })}
                    className="rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={decideMut.isPending}
                    onClick={() => decideMut.mutate({ requestId: r.id, approve: false })}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-300"
                  >
                    Reject
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3 pt-4">
        <Link
          href="/lobby"
          className="text-sm font-medium text-amber-300 underline-offset-4 hover:underline"
        >
          ← Lobby
        </Link>
        <Link
          href="/tables"
          className="text-sm font-medium text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
        >
          Tables
        </Link>
      </div>
    </div>
  );
}
