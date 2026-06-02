import { apiBase, devHeaders } from "@/lib/dev-api";
import type { TableCardModel } from "@/lib/lobby/types";

export async function fetchTablesList(): Promise<TableCardModel[] | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/tables`, {
      headers: devHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as TableCardModel[];
  } catch {
    return null;
  }
}

export interface TableSeatApi {
  seatIndex: number;
  userId: string | null;
}

export type TableSocketActionApi = "check" | "fold";

export interface TableLastActionApi {
  userId: string;
  action: TableSocketActionApi;
  at: number;
}

export interface TableDetailApi {
  table: TableCardModel;
  seats: TableSeatApi[];
  viewerSeatIndex: number | null;
  /** Server action clock (Redis); null if not started or Redis unavailable. */
  turnDeadlineEpochMs: number | null;
  /** Last socket “action” (Phase 8 dev UX; not full street engine). */
  lastAction: TableLastActionApi | null;
}

export async function fetchTableDetail(
  tableId: string,
): Promise<TableDetailApi | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/tables/${encodeURIComponent(tableId)}`, {
      headers: devHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as TableDetailApi;
  } catch {
    return null;
  }
}

export async function postCreateTable(body: {
  clubId: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  maxPlayers?: number;
  timerSeconds?: number;
  minBuyIn?: number;
}): Promise<TableCardModel | null> {
  const base = apiBase();
  if (!base) return null;
  const res = await fetch(`${base}/tables`, {
    method: "POST",
    headers: { ...devHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return (await res.json()) as TableCardModel;
}

export async function postSitAtSeat(
  tableId: string,
  seatIndex: number,
): Promise<TableDetailApi | null> {
  const base = apiBase();
  if (!base) return null;
  const res = await fetch(
    `${base}/tables/${encodeURIComponent(tableId)}/sit`,
    {
      method: "POST",
      headers: { ...devHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ seatIndex }),
    },
  );
  if (!res.ok) return null;
  return (await res.json()) as TableDetailApi;
}

export async function postLeaveSeat(
  tableId: string,
): Promise<TableDetailApi | null> {
  const base = apiBase();
  if (!base) return null;
  const res = await fetch(
    `${base}/tables/${encodeURIComponent(tableId)}/leave`,
    {
      method: "POST",
      headers: devHeaders(),
    },
  );
  if (!res.ok) return null;
  return (await res.json()) as TableDetailApi;
}

export async function postCloseTable(tableId: string): Promise<boolean> {
  const base = apiBase();
  if (!base) return false;
  const res = await fetch(
    `${base}/tables/${encodeURIComponent(tableId)}/close`,
    {
      method: "POST",
      headers: devHeaders(),
    },
  );
  return res.ok;
}
