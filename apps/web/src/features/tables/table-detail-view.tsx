"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatChips } from "@/lib/format-chips";
import { apiBase } from "@/lib/dev-api";
import {
  fetchTableDetail,
  postCloseTable,
  postLeaveSeat,
  postSitAtSeat,
} from "@/lib/lobby/api-tables";
import { useTableSocket } from "@/features/tables/use-table-socket";

function TurnCountdown({ deadlineMs }: { deadlineMs: number | null }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (deadlineMs == null) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [deadlineMs]);
  if (deadlineMs == null) return null;
  const sec = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
  return (
    <p className="mt-2 text-sm tabular-nums text-amber-200/80">
      Action clock: {sec}s
    </p>
  );
}

export function TableDetailView({ tableId }: { tableId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const live = Boolean(apiBase());

  const onTableClosed = useCallback(() => {
    router.push("/tables");
  }, [router]);

  const { emitTableAction } = useTableSocket(tableId, {
    queryClient,
    onTableClosed,
  });

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["table", tableId],
    queryFn: async () => {
      const d = await fetchTableDetail(tableId);
      if (!d) throw new Error("offline");
      return d;
    },
    retry: false,
  });

  const sitMut = useMutation({
    mutationFn: (seatIndex: number) => postSitAtSeat(tableId, seatIndex),
    onSuccess: (d) => {
      if (d) {
        void queryClient.setQueryData(["table", tableId], d);
        void queryClient.invalidateQueries({ queryKey: ["lobby"] });
        void queryClient.invalidateQueries({ queryKey: ["tables"] });
      }
    },
  });

  const leaveMut = useMutation({
    mutationFn: () => postLeaveSeat(tableId),
    onSuccess: (d) => {
      if (d) {
        void queryClient.setQueryData(["table", tableId], d);
        void queryClient.invalidateQueries({ queryKey: ["lobby"] });
        void queryClient.invalidateQueries({ queryKey: ["tables"] });
      }
    },
  });

  const closeMut = useMutation({
    mutationFn: () => postCloseTable(tableId),
    onSuccess: (ok) => {
      if (ok) {
        void queryClient.invalidateQueries({ queryKey: ["lobby"] });
        void queryClient.invalidateQueries({ queryKey: ["tables"] });
        router.push("/lobby");
      }
    },
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-lg animate-pulse px-4 py-10">
        <div className="h-8 w-2/3 rounded bg-zinc-800" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-zinc-300">
          Could not load this table. Use{" "}
          <code className="text-amber-200/90">NEXT_PUBLIC_API_URL</code> and a valid
          table id.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-zinc-950"
        >
          Retry
        </button>
        <Link href="/tables" className="mt-6 block text-sm text-amber-300 hover:underline">
          All tables
        </Link>
      </div>
    );
  }

  const { table, seats, viewerSeatIndex } = data;

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-amber-400/90">
          {table.clubName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-50">{table.name}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Blinds {table.smallBlind}/{table.bigBlind} · min buy-in{" "}
          {formatChips(table.minBuyIn)} · timer {table.timerSeconds}s ·{" "}
          {table.players}/{table.maxPlayers} seated · {table.playStatus}
        </p>
        {live ? (
          <p className="mt-2 text-[11px] text-emerald-400/90">
            Live seats · Socket.IO (Phase 8)
          </p>
        ) : null}
        <TurnCountdown deadlineMs={data.turnDeadlineEpochMs ?? null} />
        {data.lastAction ? (
          <p className="mt-2 text-xs text-zinc-500">
            Last action:{" "}
            <span className="font-medium text-zinc-300">
              {data.lastAction.action}
            </span>{" "}
            <span className="font-mono text-zinc-400">{data.lastAction.userId}</span>
          </p>
        ) : null}
      </div>

      {viewerSeatIndex !== null ? (
        <div className="flex flex-wrap gap-2">
          {live ? (
            <>
              <button
                type="button"
                onClick={() => emitTableAction("check")}
                className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-2 text-sm font-semibold text-emerald-100"
              >
                Check
              </button>
              <button
                type="button"
                onClick={() => emitTableAction("fold")}
                className="rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-200"
              >
                Fold
              </button>
            </>
          ) : null}
          <button
            type="button"
            disabled={leaveMut.isPending}
            onClick={() => leaveMut.mutate()}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-200"
          >
            {leaveMut.isPending ? "…" : "Leave seat"}
          </button>
        </div>
      ) : null}

      <section aria-labelledby="seats-h">
        <h2
          id="seats-h"
          className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500"
        >
          Seats
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {seats.map((s) => {
            const occupied = s.userId !== null;
            const isMine = s.seatIndex === viewerSeatIndex;
            return (
              <li key={s.seatIndex}>
                <div
                  className={`rounded-xl border px-3 py-3 text-center text-sm ${
                    isMine
                      ? "border-amber-500/50 bg-amber-950/30 text-amber-100"
                      : occupied
                        ? "border-white/10 bg-zinc-900/60 text-zinc-400"
                        : "border-emerald-500/30 bg-emerald-950/20 text-zinc-200"
                  }`}
                >
                  <div className="text-[10px] uppercase text-zinc-500">
                    Seat {s.seatIndex + 1}
                  </div>
                  <div className="mt-1 truncate font-mono text-xs">
                    {occupied ? s.userId : "Empty"}
                  </div>
                  {!occupied && viewerSeatIndex === null ? (
                    <button
                      type="button"
                      disabled={sitMut.isPending}
                      onClick={() => sitMut.mutate(s.seatIndex)}
                      className="mt-2 w-full rounded-lg bg-emerald-600/80 py-1 text-[11px] font-semibold text-white"
                    >
                      Sit
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4">
        <button
          type="button"
          disabled={closeMut.isPending}
          onClick={() => {
            if (confirm("Close this table for everyone? Seats will be cleared.")) {
              closeMut.mutate();
            }
          }}
          className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-2 text-sm font-medium text-rose-200"
        >
          Close table
        </button>
        <Link href="/play" className="text-sm text-zinc-400 underline-offset-4 hover:underline">
          Practice /play
        </Link>
        <Link href="/tables" className="text-sm text-zinc-400 underline-offset-4 hover:underline">
          All tables
        </Link>
      </div>
    </div>
  );
}
