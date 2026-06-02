"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatChips } from "@/lib/format-chips";
import { apiBase } from "@/lib/dev-api";
import {
  fetchTableDetail,
  type HoldemGameActionPayload,
  postCloseTable,
  postLeaveSeat,
  postSitAtSeat,
} from "@/lib/lobby/api-tables";
import { useTableSocket } from "@/features/tables/use-table-socket";
import { useAuthUserId } from "@/providers/auth-context";

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
  const authUserId = useAuthUserId();
  const live = Boolean(apiBase());

  const onTableClosed = useCallback(() => {
    router.push("/tables");
  }, [router]);

  const { emitTableAction, emitGameAction, liveSocketState } = useTableSocket(tableId, {
    queryClient,
    userId: authUserId,
    onTableClosed,
  });

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["table", tableId],
    queryFn: async () => {
      const d = await fetchTableDetail(tableId);
      if (!d) throw new Error("offline");
      return {
        ...d,
        holdem: d.holdem ?? null,
        viewerHoleCards: d.viewerHoleCards ?? null,
      };
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

  const defaultRaiseTo = useMemo(() => {
    const holdem = data?.holdem;
    const viewerSeatIndex = data?.viewerSeatIndex ?? null;
    const table = data?.table;
    const bb = table?.bigBlind ?? 10;
    if (!holdem || viewerSeatIndex === null || !table) return Math.max(bb * 2, 20);
    const myHoldemSeat = holdem.seats[String(viewerSeatIndex)];
    if (!myHoldemSeat) return bb * 2;
    const cap = myHoldemSeat.streetPut + myHoldemSeat.stack;
    const floor = Math.max(
      holdem.maxStreetBet + holdem.minRaise,
      myHoldemSeat.streetPut + 1,
    );
    return Math.min(floor, cap);
  }, [data]);

  const [raiseToDraft, setRaiseToDraft] = useState(0);
  useEffect(() => {
    setRaiseToDraft(defaultRaiseTo);
  }, [defaultRaiseTo, data?.holdem?.handSeq, data?.holdem?.toActSeat]);

  const sendEngine = useCallback(
    (a: HoldemGameActionPayload) => {
      emitGameAction(a);
    },
    [emitGameAction],
  );

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

  const { table, seats, viewerSeatIndex, actionTurn: turn, holdem, viewerHoleCards } = data;

  const holdemBetting = holdem?.phase === "betting";
  const useEngineActions = Boolean(holdemBetting);

  const isMyTurn =
    viewerSeatIndex !== null &&
    turn.actionSeatIndex !== null &&
    turn.actionSeatIndex === viewerSeatIndex &&
    table.players >= 2;

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
          liveSocketState === "ready" ? (
            <p className="mt-2 text-[11px] text-emerald-400/90">
              Live seats · Socket.IO (Phase 8)
            </p>
          ) : liveSocketState === "reconnecting" ? (
            <p className="mt-2 text-[11px] text-amber-300/95">
              Connection lost — reconnecting…
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-zinc-500">
              Connecting to live table…
            </p>
          )
        ) : null}
        <TurnCountdown deadlineMs={data.turnDeadlineEpochMs ?? null} />
        {table.players >= 2 && turn.actionSeatIndex !== null ? (
          <p className="mt-2 text-xs text-sky-200/90">
            To act: seat {turn.actionSeatIndex + 1}
            {useEngineActions ? (
              turn.facingBet ? (
                <span className="text-rose-200/90">
                  {" "}
                  · facing a bet — call, raise, or fold
                </span>
              ) : (
                <span className="text-zinc-500"> · check, bet, or fold</span>
              )
            ) : turn.facingBet ? (
              <span className="text-rose-200/90">
                {" "}
                · facing a bet — check disabled (fold or let the clock auto-fold)
              </span>
            ) : (
              <span className="text-zinc-500"> · you may check or fold</span>
            )}
          </p>
        ) : table.players < 2 ? (
          <p className="mt-2 text-xs text-zinc-500">
            Two or more seated players are required for turns to rotate.
          </p>
        ) : null}
        {data.lastAction ? (
          <p className="mt-2 text-xs text-zinc-500">
            Last action:{" "}
            <span className="font-medium text-zinc-300">
              {data.lastAction.action}
            </span>
            {data.lastAction.source === "timeout" ? (
              <span className="text-amber-200/90"> (auto — clock)</span>
            ) : null}{" "}
            <span className="font-mono text-zinc-400">{data.lastAction.userId}</span>
          </p>
        ) : null}
      </div>

      {holdem ? (
        <section className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
          <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">
            Hand #{holdem.handSeq} · {holdem.street} · {holdem.phase}
          </p>
          <p className="mt-2 text-sm text-zinc-200">
            Pot {formatChips(holdem.pot)} · board:{" "}
            <span className="font-mono text-amber-100/90">
              {holdem.board.length ? holdem.board.join(" ") : "—"}
            </span>
          </p>
          {holdem.phase === "showdown" || holdem.phase === "complete" ? (
            <p className="mt-2 text-xs text-zinc-400">
              {holdem.payouts?.length
                ? `Payouts: ${holdem.payouts.map((p) => `seat ${p.seatIndex + 1} +${p.amount}`).join(", ")}`
                : null}
            </p>
          ) : null}
          {viewerHoleCards ? (
            <p className="mt-2 text-xs text-emerald-200/90">
              Your cards:{" "}
              <span className="font-mono font-semibold">{viewerHoleCards.join(" ")}</span>
            </p>
          ) : null}
        </section>
      ) : null}

      {viewerSeatIndex !== null ? (
        <div className="flex flex-wrap items-center gap-2">
          {live && isMyTurn && useEngineActions ? (
            <>
              <button
                type="button"
                onClick={() => sendEngine({ type: "fold" })}
                className="rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-200"
              >
                Fold
              </button>
              {!turn.facingBet ? (
                <button
                  type="button"
                  onClick={() => sendEngine({ type: "check" })}
                  className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-2 text-sm font-semibold text-emerald-100"
                >
                  Check
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => sendEngine({ type: "call" })}
                  className="rounded-xl border border-sky-500/40 bg-sky-950/40 px-4 py-2 text-sm font-semibold text-sky-100"
                >
                  Call
                </button>
              )}
              {holdem && holdem.maxStreetBet === 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    sendEngine({ type: "bet", amount: Math.max(table.bigBlind, 1) })
                  }
                  className="rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-2 text-sm font-semibold text-amber-100"
                >
                  Bet {formatChips(table.bigBlind)}
                </button>
              ) : null}
              {holdem && turn.facingBet ? (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-zinc-400">
                    Raise to
                    <input
                      type="number"
                      min={1}
                      className="w-24 rounded border border-white/15 bg-zinc-950 px-2 py-1 font-mono text-zinc-100"
                      value={raiseToDraft}
                      onChange={(e) => setRaiseToDraft(Number(e.target.value))}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      sendEngine({ type: "raise_to", amount: Math.floor(raiseToDraft) })
                    }
                    className="rounded-xl border border-violet-500/40 bg-violet-950/40 px-3 py-2 text-sm font-semibold text-violet-100"
                  >
                    Raise
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
          {live && isMyTurn && !useEngineActions ? (
            <>
              {!turn.facingBet ? (
                <button
                  type="button"
                  onClick={() => emitTableAction("check")}
                  className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-2 text-sm font-semibold text-emerald-100"
                >
                  Check
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => emitTableAction("fold")}
                className="rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-200"
              >
                Fold
              </button>
            </>
          ) : null}
          {live && viewerSeatIndex !== null && !isMyTurn && table.players >= 2 ? (
            <span className="text-xs text-zinc-500">Not your turn — watch the seat highlight.</span>
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
            const isToAct =
              table.players >= 2 &&
              turn.actionSeatIndex !== null &&
              s.seatIndex === turn.actionSeatIndex;
            return (
              <li key={s.seatIndex}>
                <div
                  className={`rounded-xl border px-3 py-3 text-center text-sm ${
                    isToAct
                      ? "border-sky-500/55 bg-sky-950/30 text-sky-100 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                      : isMine
                        ? "border-amber-500/50 bg-amber-950/30 text-amber-100"
                        : occupied
                          ? "border-white/10 bg-zinc-900/60 text-zinc-400"
                          : "border-emerald-500/30 bg-emerald-950/20 text-zinc-200"
                  }`}
                >
                  <div className="text-[10px] uppercase text-zinc-500">
                    Seat {s.seatIndex + 1}
                    {isToAct ? (
                      <span className="ml-1 font-semibold text-sky-300">· to act</span>
                    ) : null}
                  </div>
                  <div className="mt-1 truncate font-mono text-xs">
                    {occupied ? s.userId : "Empty"}
                  </div>
                  {occupied && holdem?.seats[String(s.seatIndex)] ? (
                    <div className="mt-0.5 text-[10px] text-zinc-500">
                      Stack {formatChips(holdem.seats[String(s.seatIndex)]!.stack)}
                      {holdem.seats[String(s.seatIndex)]!.folded ? (
                        <span className="ml-1 text-rose-400">· folded</span>
                      ) : null}
                    </div>
                  ) : null}
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
