"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  HoldemGameActionPayload,
  TableDetailApi,
  TableSocketActionApi,
} from "@/lib/lobby/api-tables";
import { apiBase } from "@/lib/dev-api";

function tableSocketOrigin(): string | null {
  const base = apiBase();
  if (!base) return null;
  if (base.startsWith("/")) {
    if (typeof window === "undefined") return null;
    return window.location.origin;
  }
  return base;
}

/**
 * Socket.IO path for table presence + `tableState` (Phase 8).
 * - `inactive`: no API URL / no table id / cleaned up
 * - `connecting`: first connection in progress
 * - `ready`: connected and `joinTable` will run / has run on this connection
 * - `reconnecting`: dropped after a successful session; client is retrying
 */
export type TableLiveSocketState =
  | "inactive"
  | "connecting"
  | "ready"
  | "reconnecting";

/**
 * Subscribes to `tableState` / `tableClosed` for a table (Phase 8).
 * When `NEXT_PUBLIC_API_URL` is a path (e.g. `/api`), connects to `window.location.origin` with `/socket.io` (Next rewrites).
 * Re-joins the table room on every `connect` and `reconnect` so state stays correct after network blips.
 */
export function useTableSocket(
  tableId: string | undefined,
  opts: {
    queryClient: QueryClient;
    userId: string;
    onTableClosed?: () => void;
  },
) {
  const { queryClient, userId } = opts;
  const onClosedRef = useRef(opts.onTableClosed);
  onClosedRef.current = opts.onTableClosed;

  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const socketRef = useRef<Socket | null>(null);
  const tableIdRef = useRef(tableId);
  tableIdRef.current = tableId;

  const [liveSocketState, setLiveSocketState] =
    useState<TableLiveSocketState>("inactive");

  const emitGameAction = useCallback((action: HoldemGameActionPayload) => {
    const tid = tableIdRef.current;
    const socket = socketRef.current;
    if (!tid) return;
    if (!socket?.connected) {
      console.warn(
        "[table socket] gameAction skipped: socket not connected yet (wait for Live).",
        action,
      );
      return;
    }
    socket.emit(
      "gameAction",
      { tableId: tid, action },
      (ack: { ok?: boolean; error?: string } | undefined) => {
        if (ack && ack.ok === false && ack.error) {
          console.warn("[table socket] gameAction:", ack.error);
        }
      },
    );
  }, []);

  const emitTableAction = useCallback((action: TableSocketActionApi) => {
    const tid = tableIdRef.current;
    const socket = socketRef.current;
    if (!tid) return;
    if (!socket?.connected) {
      console.warn(
        "[table socket] tableAction skipped: socket not connected yet (wait for Live).",
        action,
      );
      return;
    }
    socket.emit(
      "tableAction",
      { tableId: tid, action },
      (ack: { ok?: boolean; error?: string } | undefined) => {
        if (ack && ack.ok === false && ack.error) {
          console.warn("[table socket] tableAction:", ack.error);
        }
      },
    );
  }, []);

  useEffect(() => {
    if (!tableId) {
      socketRef.current = null;
      setLiveSocketState("inactive");
      return;
    }
    const base = apiBase();
    if (!base) {
      socketRef.current = null;
      setLiveSocketState("inactive");
      return;
    }

    const origin = tableSocketOrigin();
    if (!origin) {
      socketRef.current = null;
      setLiveSocketState("inactive");
      return;
    }

    setLiveSocketState("connecting");
    let cancelled = false;

    const socket: Socket = io(origin, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { userId },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      timeout: 20_000,
    });
    socketRef.current = socket;

    const emitJoinTable = () => {
      const tid = tableIdRef.current;
      if (!tid || cancelled) return;
      socket.emit(
        "joinTable",
        { tableId: tid },
        (ack: { ok?: boolean; error?: string } | undefined) => {
          if (cancelled) return;
          if (ack && ack.ok === false && ack.error) {
            console.warn("[table socket] joinTable:", ack.error);
            void queryClient.invalidateQueries({ queryKey: ["table", tid] });
          }
        },
      );
    };

    socket.on("connect", () => {
      if (cancelled) return;
      setLiveSocketState("ready");
      emitJoinTable();
    });

    const onManagerReconnect = () => {
      if (cancelled) return;
      setLiveSocketState("ready");
      emitJoinTable();
    };
    socket.io.on("reconnect", onManagerReconnect);

    socket.on("disconnect", (reason: string) => {
      if (cancelled) return;
      if (reason === "io client disconnect") {
        setLiveSocketState("inactive");
        return;
      }
      setLiveSocketState("reconnecting");
    });

    socket.on("connect_error", (err: Error) => {
      if (cancelled) return;
      console.warn("[table socket] connect_error:", err?.message ?? err);
    });

    socket.on(
      "tableState",
      (
        payload: Pick<
          TableDetailApi,
          | "table"
          | "seats"
          | "turnDeadlineEpochMs"
          | "lastAction"
          | "actionTurn"
          | "holdem"
        >,
      ) => {
        const tid = tableIdRef.current;
        if (!tid) return;
        const prev = queryClient.getQueryData<TableDetailApi>(["table", tid]);
        const row = payload.seats.find((s) => s.userId === userIdRef.current);
        const viewerSeatIndex = row ? row.seatIndex : null;
        const merged: TableDetailApi = {
          table: payload.table,
          seats: payload.seats,
          viewerSeatIndex,
          turnDeadlineEpochMs: payload.turnDeadlineEpochMs ?? null,
          lastAction: payload.lastAction ?? null,
          actionTurn: payload.actionTurn ?? {
            actionSeatIndex: null,
            facingBet: false,
          },
          holdem: payload.holdem ?? null,
          viewerHoleCards:
            payload.holdem == null || payload.holdem.phase === "complete"
              ? null
              : (prev?.viewerHoleCards ?? null),
        };
        queryClient.setQueryData<TableDetailApi>(["table", tid], merged);
        const h = payload.holdem;
        if (
          h?.phase === "betting" &&
          prev?.holdem?.handSeq !== h.handSeq &&
          viewerSeatIndex !== null
        ) {
          void queryClient.invalidateQueries({ queryKey: ["table", tid] });
        }
      },
    );

    socket.on("yourHoleCards", (body: { cards?: [string, string] }) => {
      const tid = tableIdRef.current;
      if (!tid || !body?.cards || body.cards.length !== 2) return;
      queryClient.setQueryData<TableDetailApi>(["table", tid], (old) =>
        old
          ? { ...old, viewerHoleCards: body.cards as [string, string] }
          : old,
      );
    });

    socket.on("tableClosed", () => {
      const tid = tableIdRef.current;
      void queryClient.invalidateQueries({ queryKey: ["lobby"] });
      void queryClient.invalidateQueries({ queryKey: ["tables"] });
      if (tid) queryClient.removeQueries({ queryKey: ["table", tid] });
      onClosedRef.current?.();
    });

    return () => {
      cancelled = true;
      socketRef.current = null;
      setLiveSocketState("inactive");
      socket.io.off("reconnect", onManagerReconnect);
      if (socket.connected) {
        socket.emit("leaveTable", { tableId });
      }
      socket.removeAllListeners();
      socket.close();
    };
  }, [tableId, queryClient, userId]);

  return { emitTableAction, emitGameAction, liveSocketState };
}
