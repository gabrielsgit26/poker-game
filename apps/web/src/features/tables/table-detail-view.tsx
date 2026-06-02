"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { PokerTableSvgView } from "@/features/tables/poker-table-svg-view";
import type { PokerTableBridge } from "@/features/tables/poker-table-ui-types";
import { useTableSocket } from "@/features/tables/use-table-socket";
import { apiBase } from "@/lib/dev-api";
import {
  fetchTableDetail,
  type HoldemGameActionPayload,
  type TableDetailApi,
  postCloseTable,
  postLeaveSeat,
  postSitAtSeat,
} from "@/lib/lobby/api-tables";
import { useAuthUserId } from "@/providers/auth-context";

type TableGameHostProps = {
  data: TableDetailApi;
  live: boolean;
  liveReady: boolean;
  sitPendingSeat: number | null;
  defaultRaiseTo: number;
  viewerUserId: string | null;
  onSit: (seatIndex: number) => void;
  onEngineAction: (a: HoldemGameActionPayload) => void;
  onTableAction: (a: "check" | "fold") => void;
  onLeaveSeat: () => void;
  onCloseTable: () => void;
};

function TableGameHost({
  data,
  live,
  liveReady,
  sitPendingSeat,
  defaultRaiseTo,
  viewerUserId,
  onSit,
  onEngineAction,
  onTableAction,
  onLeaveSeat,
  onCloseTable,
}: TableGameHostProps) {
  const router = useRouter();

  const bridge = useMemo<PokerTableBridge>(
    () => ({
      onSit,
      onLeave: onLeaveSeat,
      onBack: () => {
        router.push("/tables");
      },
      onNavigate: (to) => {
        const paths = { lobby: "/lobby", tables: "/tables", play: "/play", settings: "/settings" } as const;
        router.push(paths[to]);
      },
      onCloseTable: onCloseTable,
      onEngineAction,
      onTableAction,
    }),
    [onSit, onLeaveSeat, router, onCloseTable, onEngineAction, onTableAction],
  );

  return (
    <PokerTableSvgView
      data={data}
      live={live}
      liveReady={liveReady}
      sitPendingSeat={sitPendingSeat}
      defaultRaiseTo={defaultRaiseTo}
      viewerUserId={viewerUserId}
      bridge={bridge}
    />
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
    if (cap <= 0) return Math.max(bb * 2, 20);
    const floor = Math.max(
      holdem.maxStreetBet + holdem.minRaise,
      myHoldemSeat.streetPut + 1,
    );
    return Math.min(floor, cap);
  }, [data]);

  const [sitPendingSeat, setSitPendingSeat] = useState<number | null>(null);

  const trySitAtSeat = useCallback(
    (seatIndex: number) => {
      setSitPendingSeat(seatIndex);
      sitMut.mutate(seatIndex, {
        onSettled: () => setSitPendingSeat(null),
      });
    },
    [sitMut],
  );

  const sendEngine = useCallback(
    (a: HoldemGameActionPayload) => {
      emitGameAction(a);
    },
    [emitGameAction],
  );

  const liveReady = live && liveSocketState === "ready";

  const onLeaveSeat = useCallback(() => {
    if (typeof window !== "undefined" && window.confirm("Leave your seat?")) {
      leaveMut.mutate();
    }
  }, [leaveMut]);

  const onCloseTable = useCallback(() => {
    if (typeof window !== "undefined" && window.confirm("Close this table for everyone?")) {
      closeMut.mutate();
    }
  }, [closeMut]);

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-[#2a1018] to-black px-4">
        <div className="h-10 w-48 animate-pulse rounded-xl bg-zinc-800/80" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-[#2a1018] to-black px-4 text-center">
        <p className="max-w-sm text-zinc-300">
          Could not load this table. Use{" "}
          <code className="text-amber-200/90">NEXT_PUBLIC_API_URL</code> and a valid table id.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 rounded-full bg-amber-500 px-6 py-2 text-sm font-bold text-zinc-950"
        >
          Retry
        </button>
        <Link href="/tables" className="mt-8 text-sm text-amber-300/90 underline-offset-4 hover:underline">
          Lobby
        </Link>
      </div>
    );
  }

  return (
    <TableGameHost
      data={data}
      live={live}
      liveReady={liveReady}
      sitPendingSeat={sitPendingSeat}
      defaultRaiseTo={defaultRaiseTo}
      viewerUserId={authUserId}
      onSit={trySitAtSeat}
      onEngineAction={sendEngine}
      onTableAction={emitTableAction}
      onLeaveSeat={onLeaveSeat}
      onCloseTable={onCloseTable}
    />
  );
}
