"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import type { TableDetailApi, TableSocketActionApi } from "@/lib/lobby/api-tables";
import { DEV_USER_ID, apiBase } from "@/lib/dev-api";

/**
 * Subscribes to `tableState` / `tableClosed` for a table (Phase 8).
 * Uses the same origin as `NEXT_PUBLIC_API_URL` (default path `/socket.io`).
 */
export function useTableSocket(
  tableId: string | undefined,
  opts: {
    queryClient: QueryClient;
    onTableClosed?: () => void;
  },
) {
  const { queryClient } = opts;
  const onClosedRef = useRef(opts.onTableClosed);
  onClosedRef.current = opts.onTableClosed;

  const socketRef = useRef<Socket | null>(null);
  const tableIdRef = useRef(tableId);
  tableIdRef.current = tableId;

  const emitTableAction = useCallback((action: TableSocketActionApi) => {
    const tid = tableIdRef.current;
    const socket = socketRef.current;
    if (!tid || !socket?.connected) return;
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
      return;
    }
    const base = apiBase();
    if (!base) return;

    const socket: Socket = io(base, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { userId: DEV_USER_ID },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit(
        "joinTable",
        { tableId },
        (ack: { ok?: boolean; error?: string } | undefined) => {
          if (ack && ack.ok === false && ack.error) {
            console.warn("[table socket] joinTable:", ack.error);
          }
        },
      );
    });

    socket.on(
      "tableState",
      (
        payload: Pick<
          TableDetailApi,
          "table" | "seats" | "turnDeadlineEpochMs" | "lastAction"
        >,
      ) => {
        const row = payload.seats.find((s) => s.userId === DEV_USER_ID);
        const viewerSeatIndex = row ? row.seatIndex : null;
        queryClient.setQueryData<TableDetailApi>(["table", tableId], {
          table: payload.table,
          seats: payload.seats,
          viewerSeatIndex,
          turnDeadlineEpochMs: payload.turnDeadlineEpochMs ?? null,
          lastAction: payload.lastAction ?? null,
        });
      },
    );

    socket.on("tableClosed", () => {
      void queryClient.invalidateQueries({ queryKey: ["lobby"] });
      void queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.removeQueries({ queryKey: ["table", tableId] });
      onClosedRef.current?.();
    });

    return () => {
      socketRef.current = null;
      if (socket.connected) {
        socket.emit("leaveTable", { tableId });
      }
      socket.removeAllListeners();
      socket.close();
    };
  }, [tableId, queryClient]);

  return { emitTableAction };
}
